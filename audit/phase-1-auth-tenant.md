# Phase 1 — Audit Authentification & Multi-tenant — Klik&Go

Date : 2026-04-26
Périmètre : `src/middleware.ts`, `src/lib/auth/**`, `src/lib/boucher-auth.ts`, `src/lib/admin-auth.ts`, `src/app/api/**` (181 routes), `next.config.mjs`, webhooks Clerk + Stripe.

---

## 1. Synthèse

**Score sécurité auth/tenant : 7.0 / 10**

Le projet a une posture défensive correcte : middleware Clerk avec gating par rôle + cache Redis, helpers `getAuthenticatedBoucher()` / `requireAdmin()` largement utilisés, scoping `shopId` systématique sur la majorité des routes boucher, vérification Svix sur `/api/webhooks/clerk`, headers de sécurité OK. **Aucune route business n'est non-authentifiée**, hormis quelques `SERVICE_DISABLED` placeholders (cart/add, cart/reserve, payments) qui sont sûrs.

Cependant, il subsiste **plusieurs trous critiques** : (1) le test-mode bypass est gardé uniquement par un cookie public `klikgo-test-activated=true` que **n'importe quel client peut poser dans son navigateur** dès que `NEXT_PUBLIC_TEST_MODE=true` est en prod — c'est tout le système d'auth qui tombe ; (2) `proxy.ts` (16k mort) et `middleware.ts` (14k actif) divergent — risque d'activation accidentelle ; (3) le cache Redis du rôle (TTL 5 min) n'est **jamais invalidé** sur changement de rôle (admin promote/revoke, validate-pro), un user rétrogradé garde l'accès jusqu'à 5 min ; (4) plusieurs routes (`shops/register`, `pro-request`, `is-pro`, `chat`, `users/me/location`) cherchent l'ownerId / le user en utilisant **uniquement le clerkId** sans la clause OR documentée, ce qui peut **soit** laisser créer plusieurs shops par le même owner (legacy) soit casser l'auth selon l'historique des données ; (5) CSP autorise toujours `'unsafe-inline' 'unsafe-eval'` côté script.

Multi-tenant : très solide globalement — chaque mutation passe par `where: { shopId, ... }` ou contrôle ownership avant. Pas de fuite cross-tenant détectée sur les routes orders/products/categories/uploads/anti-gaspi/snooze/calendar/clients/shop-offers.

---

## 2. Findings 🔴 critiques

### 🔴 Test-mode bypass gardé uniquement par un cookie côté client

📁 Fichier : `src/middleware.ts:17-20`, `src/lib/auth/server-auth.ts:9-14`, `src/lib/boucher-auth.ts:24-42`, `src/lib/admin-auth.ts:18-26`
🐛 Problème : Le bypass complet de Clerk + élévation au rôle ADMIN/BOUCHER est activé dès que :
- `process.env.NEXT_PUBLIC_TEST_MODE === "true"` (côté serveur, mais bakée au build),
- `cookie klikgo-test-activated === "true"` (cookie HTTP normal, pas signé, pas httpOnly garanti — l'utilisateur peut le poser via DevTools),
- `cookie klikgo-test-role` choisit le rôle (`CLIENT|BOUCHER|ADMIN`).

Le « secret » `NEXT_PUBLIC_TEST_SECRET` n'est utilisé que pour poser ce cookie via une route `/?testmode=...`, mais une fois la valeur connue (et c'est une variable `NEXT_PUBLIC_*`, donc **exposée dans le bundle JS**), n'importe qui peut activer le mode admin sur prod en posant simplement le cookie.

Pire : `getAuthenticatedBoucher()` en test mode renvoie le `shopId` de la **première boutique de la DB** (`prisma.shop.findFirst({ orderBy: { createdAt: "asc" } })`) — donc un attaquant prend le contrôle de la plus ancienne boucherie de la plateforme.

💥 Impact : RCE équivalent — vol total de comptes BOUCHER/ADMIN, fuite/modification de toutes les commandes, suspend de boutiques, gestion des clés API webmaster.
✅ Fix : 
1. Si `NEXT_PUBLIC_TEST_MODE !== "true"` en prod (ce qui doit être le cas), confirmer qu'aucune env var Vercel ne l'active sur klikandgo.app.
2. Renommer en `TEST_MODE` (sans `NEXT_PUBLIC_`) pour qu'elle soit privée serveur uniquement.
3. Le cookie d'activation doit être signé HMAC côté serveur (signature du secret côté serveur), pas une simple valeur `"true"`. Vérifier la signature dans `isTestActivated()`.
4. Restreindre par IP / domaine de preview Vercel.
À vérifier : grep `NEXT_PUBLIC_TEST_MODE` dans les env Vercel — si la valeur en prod est `"true"`, **c'est exploitable maintenant**.

### 🔴 Cache de rôle Redis (5 min) jamais invalidé

📁 Fichier : `src/middleware.ts:35-87` (cache rôle middleware), `src/lib/admin-auth.ts:11-12,57` (cache `requireAdmin`), `src/lib/boucher-auth.ts:10-13,58-61,88-95` (cache shopId boucher)
🐛 Problème : Trois caches distincts mémorisent le rôle / l'ownership :
- middleware : `role:${userId}` Redis 5 min,
- `requireAdmin` : Map mémoire 5 min par instance,
- `getAuthenticatedBoucher` : `boucher:auth:${clerkId}` Redis 5 min + Map mémoire 5 min.

Lorsque un admin demote un user via `/api/admin/users/[id]` (rôle CLIENT) ou révoque un staff via `/api/webmaster/staff/[userId]`, ou rejette un PRO via `/api/users/[id]/validate-pro`, **aucun de ces caches n'est invalidé**. Le user gardera son accès admin/boucher pendant 5 minutes.

Pire encore pour boucher-auth : si on transfère un shop (changement de `Shop.ownerId`), le cache du précédent owner pointe encore sur le shopId — il continue de **modifier les commandes du nouveau propriétaire**.

💥 Impact : Fenêtre de 5 min pendant laquelle un compte compromis ou un employé licencié garde tous ses droits, y compris pour traiter des commandes ou supprimer des produits. Risque réputationnel + audit RGPD.
✅ Fix : Invalider les 3 caches lors de :
- `PATCH /api/admin/users/[id]` (admin-auth.ts:51) → `redis.del("role:" + clerkId)`, `adminCache.delete()`, `redis.del("boucher:auth:" + clerkId)`.
- `PATCH /api/webmaster/staff/[userId]` (idem).
- `POST /api/users/[id]/validate-pro` (idem si reject).
- `PATCH /api/admin/shops/[shopId]/suspend` → invalider boucher-auth de l'owner.
- Idéalement, exposer un helper `invalidateUserAuthCaches(clerkId)`.

### 🔴 Test-mode admin élève le rôle sans vérifier que le clerkId est bien un test user

📁 Fichier : `src/lib/admin-auth.ts:20-26`, `src/lib/auth/server-auth.ts:50-70`
🐛 Problème : `requireAdmin()` en test-mode renvoie immédiatement `{ userId: TEST_USERS.ADMIN.clerkId }` dès que `isTestActivated()` ET `getTestRole() === "ADMIN"`. Le `userId` réel de Clerk n'est pas regardé — donc **un user Clerk authentifié qui a le cookie `klikgo-test-role=ADMIN`** devient admin au lieu de l'usual test user.

`writeAuditLog` enregistre alors `actorId = "test-admin-001"` au lieu du vrai clerkId — perte totale de traçabilité.

💥 Impact : Lié au finding ci-dessus — escalation de privilèges + masquage de l'auditeur.
✅ Fix : En test-mode, vérifier que le `userId` Clerk authentifié appartient bien à `TEST_USERS` avant de bypasser. Sinon, fallback normal.

### 🔴 `shops/register` ne détecte pas un shop déjà existant si `ownerId` stocké en dbUser.id

📁 Fichier : `src/app/api/shops/register/route.ts:42-47,92`
🐛 Problème : 
```ts
const existingShop = await prisma.shop.findFirst({
  where: { ownerId: userId },  // userId = clerkId
});
```
La règle CLAUDE.md dit que `Shop.ownerId` peut stocker soit le clerkId soit le `dbUser.id`. Si le shop précédent du user a été créé avec `dbUser.id` (cas du flow `onboarding/route.ts:111` qui stocke `user.id`, c'est-à-dire le Prisma id), alors `findFirst` ne le trouve pas.

→ Le user peut créer un **deuxième shop** lié à son clerkId, ce qui (a) double le shopId associé, (b) `getAuthenticatedBoucher` retournera un shop différent à chaque requête selon le ordering, (c) `Shop.slug` reste unique mais on a 2 entités liées au même propriétaire.

💥 Impact : Cohérence DB cassée + comportement incohérent du back-office boucher (alterne entre 2 shops). Bypass du modèle économique « 1 boucher = 1 shop ».
✅ Fix : Utiliser systématiquement la clause OR :
```ts
const dbUser = await getOrCreateUser(userId);
const existingShop = await prisma.shop.findFirst({
  where: { OR: [{ ownerId: userId }, { ownerId: dbUser?.id }] },
});
```

### 🔴 `shops/[id]/pro-requests/[proAccessId]` n'utilise PAS la clause OR ownership

📁 Fichier : `src/app/api/shops/[id]/pro-requests/[proAccessId]/route.ts:28-30`
🐛 Problème : 
```ts
if (shop.ownerId !== clerkId) {
  return apiError("FORBIDDEN", "Accès refusé");
}
```
Pas de fallback sur `dbUser.id`. Si le shop a été créé via `onboarding/route.ts` (qui stocke `user.id` en ownerId), le boucher légitime se voit **refuser l'accès à ses propres demandes Pro**, ou pire, si la donnée a drifté, un autre user peut passer.

💥 Impact : Boucher ne peut pas valider ses demandes Pro → fonctionnalité cassée. Pas une fuite cross-tenant pour autant (puisque le check est restrictif), mais cohérence + UX.
✅ Fix : Lookup `dbUser.id` et `OR` clause.

### 🔴 CSP autorise `'unsafe-inline' 'unsafe-eval'` sur script-src

📁 Fichier : `next.config.mjs:69`
🐛 Problème : `script-src 'self' 'unsafe-inline' 'unsafe-eval' …`. Tout XSS devient exploitable comme RCE navigateur (vol session Clerk via JS). Le commentaire de l'audit précédent disait que c'était à corriger.
💥 Impact : Si un seul XSS est introduit (commentaire produit, support ticket, review), c'est game over pour la session du user (cookie httpOnly Clerk, mais token JWT en localStorage / sessionStorage est lisible).
✅ Fix : Migrer vers nonce-based CSP (Next.js 14 supporte). Ou au minimum supprimer `unsafe-eval`. Audit Clerk : leurs scripts modernes n'ont plus besoin de `unsafe-eval`.

---

## 3. Findings 🟡 importants

### 🟡 `src/proxy.ts` mort coexiste avec `middleware.ts` actif

📁 Fichier : `src/proxy.ts`
🐛 Problème : Fichier de 28 lignes destiné à Next.js 16+ (`proxy.ts`). Sur Next.js 14, c'est `middleware.ts` qui est exécuté. Le `proxy.ts` ne protège donc **rien** mais est commit. Risque de confusion pour un mainteneur futur, et risque de bascule accidentelle si Next 16 atterrit sans audit.
💥 Impact : Si Next.js est upgradé en 16+, `middleware.ts` pourrait être ignoré et seul `proxy.ts` serait actif — or `proxy.ts` ne couvre PAS les routes `/admin`, `/onboarding`, et n'a pas la logique de cache Redis ni le bypass test-mode. Effondrement silencieux des protections.
✅ Fix : Supprimer `proxy.ts` (préférable) ou le synchroniser avec `middleware.ts`.

### 🟡 `users/me/location` : update par clerkId sans guarantee d'existence

📁 Fichier : `src/app/api/users/me/location/route.ts:26-31`
🐛 Problème : `prisma.user.update({ where: { clerkId: userId }, ... })`. Si l'utilisateur n'est pas encore dans la DB (webhook Clerk en retard), Prisma jette `P2025 RecordNotFound`. Pas de `getOrCreateUser`. Géré par `handleApiError` mais retourne 500 (mauvaise UX, log bruyant).
💥 Impact : Bug, pas une faille — non-disponibilité ponctuelle.
✅ Fix : Utiliser `getOrCreateUser(userId)` puis update par `id`.

### 🟡 `chat/route.ts` lookup user par clerkId uniquement

📁 Fichier : `src/app/api/chat/route.ts:181`
🐛 Problème : `prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } })`. Acceptable ici (le user devrait toujours exister puisqu'il a Clerk), mais si la DB row n'existe pas, on perd le contexte des commandes récentes. Le commentaire `// Auth/DB failed — non-blocking` masque le problème.
💥 Impact : UX uniquement.
✅ Fix : `getOrCreateUser`.

### 🟡 `is-pro/route.ts` lookup user par clerkId uniquement

📁 Fichier : `src/app/api/shops/[id]/is-pro/route.ts:20-23`
🐛 Problème : `prisma.user.findUnique({ where: { clerkId } })` puis 404 si pas trouvé. Même problème, mais retourne `Utilisateur introuvable` à un user Clerk authentifié pourtant valide.
💥 Impact : UX.
✅ Fix : `getOrCreateUser`.

### 🟡 `pro-request/route.ts` même pattern

📁 Fichier : `src/app/api/shops/[id]/pro-request/route.ts:27-30`
🐛 Problème : Idem.
✅ Fix : `getOrCreateUser`.

### 🟡 `auth/check-admin` permet lookup `findFirst` sans `clerkId` indexé pour le fallback

📁 Fichier : `src/app/api/auth/check-admin/route.ts:28-31`
🐛 Problème : Si Clerk metadata n'a pas `role`, fallback vers DB. OK mais après l'admin-auth principal qui a déjà fait le check — duplique la logique.
💥 Impact : Mineur — performance.
✅ Fix : Utiliser `requireAdmin()` à la place.

### 🟡 `getBoucherOwnerUserId()` retourne le ownerId du **premier shop de toute la plateforme** en test mode

📁 Fichier : `src/lib/auth/server-auth.ts:50-70`
🐛 Problème : 
```ts
const firstShop = await prisma.shop.findFirst({
  select: { ownerId: true },
  orderBy: { createdAt: "asc" },
});
return firstShop?.ownerId || null;
```
Si on est en test mode + rôle BOUCHER ou ADMIN, on devient owner du premier shop, mais ce shop **n'est PAS un shop de test**, c'est le plus ancien shop réel (probablement « Boucherie Tarik »). Combiné avec le finding 🔴 #1, c'est bingo.
💥 Impact : Compromission du compte boucher principal (cf. finding #1).
✅ Fix : Lié au #1 — restreindre test-mode à des shops marqués `isTestData = true`.

### 🟡 Webhook Clerk : pas de log d'audit + pas de tolérance aux events dupliqués

📁 Fichier : `src/app/api/webhooks/clerk/route.ts`
🐛 Problème : Signature Svix bien vérifiée (✅). Mais : (1) `prisma.user.update({ where: { clerkId: id } })` sur `user.deleted` jette si le user n'existe pas en DB. (2) `user.created` pour un user déjà inséré jettera P2002 (unique constraint), masqué en 500. (3) Aucune trace `AuditLog` des events.
💥 Impact : Webhook qui retry (Svix retry 5x sur 500) peut spammer la DB.
✅ Fix : Idempotence : `findUnique` avant create/update, `try/catch` granulaire, log structuré.

### 🟡 `admin/shops/[shopId]` : owner lookup par clerkId uniquement

📁 Fichier : `src/app/api/admin/shops/[shopId]/route.ts:36-39`
🐛 Problème : 
```ts
const owner = await prisma.user.findFirst({
  where: { clerkId: shop.ownerId },
  ...
});
```
Si `Shop.ownerId` stocke un `dbUser.id` (cf. `onboarding/route.ts`), `clerkId: shop.ownerId` ne matche jamais → admin voit `owner: null`.
💥 Impact : UX admin / display.
✅ Fix : `where: { OR: [{ clerkId: shop.ownerId }, { id: shop.ownerId }] }`.

### 🟡 `pro-request/route.ts` : notify shop owner via clerkId uniquement

📁 Fichier : `src/app/api/shops/[id]/pro-request/route.ts:71-73`
🐛 Problème : `prisma.user.findUnique({ where: { clerkId: shop.ownerId } })` — si `ownerId` est un dbUser.id, le boucher ne reçoit jamais la notif.
💥 Impact : Notif manquée.
✅ Fix : OR clause.

### 🟡 `getServerUserId()` test-mode : pas de garde sur le `testRole` reçu

📁 Fichier : `src/lib/auth/server-auth.ts:24-28`
🐛 Problème : `const testRole = (cookieStore.get("klikgo-test-role")?.value || "CLIENT") as TestRole`. Si le cookie contient une valeur arbitraire (ex: `WEBMASTER`), on cast en `TestRole` → `TEST_USERS[testRole]` → `undefined` → return `null`. Au moins ce n'est pas une élévation, mais la cast `as TestRole` masque le problème en TypeScript.
💥 Impact : Mineur.
✅ Fix : Validation explicite du cookie via Zod.

### 🟡 `recurring-orders` PATCH manquant + pas de scope shop sur frequency

📁 Fichier : `src/app/api/recurring-orders/route.ts`
🐛 Problème : Pas de PATCH (modifier fréquence). DELETE (ligne 154) fait `findUnique({ where: { id } })` puis check `existing.userId !== user.id`. Pas de scope shop, mais c'est cohérent vu que `RecurringOrder` est user-scoped.
💥 Impact : Aucun, juste à noter.

### 🟡 `admin/users/[id]` PATCH ne loggue pas en AuditLog

📁 Fichier : `src/app/api/admin/users/[id]/route.ts:51-69`
🐛 Problème : Pas de `writeAuditLog` lors d'un changement de rôle (CLIENT→ADMIN). Or `webmaster/staff` le fait. Asymétrie traçabilité.
💥 Impact : RGPD + audit trail incomplet.
✅ Fix : Ajouter `writeAuditLog({ action: "user.role.change", ... })`.

### 🟡 `shops/register` ne valide pas que le SIRET n'est pas déjà utilisé

📁 Fichier : `src/app/api/shops/register/route.ts`
🐛 Problème : Pas d'unique check sur `siret`. Risque : 2 shops avec même SIRET (légalement interdit + permettrait à un user de créer plusieurs shops avec un SIRET volé).
💥 Impact : Légal / fraude.
✅ Fix : Ajouter check `findFirst({ where: { siret: data.siret } })`.

---

## 4. Findings 🟢 améliorations

### 🟢 Test-mode : variables `NEXT_PUBLIC_*` baked au build

📁 Fichier : `src/lib/auth/test-auth.ts:38-45`
Recommandation : Renommer en `TEST_MODE` / `TEST_SECRET` (sans `NEXT_PUBLIC_`). Les vars `NEXT_PUBLIC_*` sont visibles dans le bundle JavaScript livré aux clients ; n'importe qui peut lire le secret en inspectant le code source.

### 🟢 Pas de protection CSRF custom sur les routes mutations

📁 Routes : toutes les `POST`/`PATCH`/`DELETE`
Clerk gère CSRF via les cookies SameSite=Lax + JWT en header. À condition que les fetch côté client utilisent `credentials: "include"` et un domaine. Sur cross-origin, l'attaquant ne peut pas atteindre nos APIs. ✅ Acceptable. Mais un check `origin` / `referer` côté API n'est pas redondant.

### 🟢 Routes SSE (`orders/stream`, `boucher/orders/stream`) : pas de timeout

📁 Fichier : `src/app/api/orders/[id]/stream/route.ts`, `src/app/api/boucher/orders/stream/route.ts`
Recommandation : Sur Vercel, les routes serverless ont un timeout (10-300s). Mais il n'y a pas de close explicite après N min. Le `setInterval` continue jusqu'au close client. OK pour l'instant.

### 🟢 `health/route.ts` non protégé

📁 Fichier : `src/app/api/health/route.ts`
Recommandation : OK pour les sondes Vercel, mais attention à ne pas exposer de détails sur la stack (DB version, etc.).

### 🟢 `geo/route.ts` non authentifié

📁 Fichier : `src/app/api/geo/route.ts`
Recommandation : Vérifier rate-limit (probablement OK).

### 🟢 `shops/nearby` non authentifié

📁 Fichier : `src/app/api/shops/nearby/route.ts`
Recommandation : Public OK. Vérifier que ne retourne pas de données sensibles (siret, ownerId, email boucher, phone privé).

### 🟢 `shops/[id]/products/validate` non authentifié, no rate limit

📁 Fichier : `src/app/api/shops/[id]/products/validate/route.ts`
Recommandation : Permet de tester l'existence de productIds. Faible risque (énumération) mais ajouter rate limit serait sain.

### 🟢 `support/faq` public OK

📁 Fichier : `src/app/api/support/faq/route.ts`
Recommandation : Aucun.

### 🟢 `calendar-events` public OK

📁 Fichier : `src/app/api/calendar-events/route.ts`
Recommandation : Aucun.

### 🟢 Webhooks Clerk : tolérance soft delete OK

📁 Fichier : `src/app/api/webhooks/clerk/route.ts:127-149`
Recommandation : OK. Mais `clerkId: \`deleted_${id}\`` ne respecte pas l'unique si Clerk renvoie deux deletes pour le même id (race) — mineur.

### 🟢 Isolation tenant sur cart (✅ OK)

`src/app/api/cart/route.ts` — toutes les opérations passent par `userId_shopId` composite ou `cart.userId`. Pas de fuite.

### 🟢 Isolation tenant sur orders/[id]/* (✅ OK)

Toutes les routes d'action boucher (`accept`, `deny`, `ready`, etc.) vérifient `order.shopId !== shopId` après lookup. Toutes les routes client (`cancel`, `respond`, `rate`, etc.) vérifient `order.user.clerkId !== userId`. Pas de fuite.

### 🟢 Isolation tenant sur boucher/orders/pickup (✅ OK)

`/api/boucher/orders/pickup` cherche `findFirst({ where: { qrCode, shopId } })` — défense en profondeur impeccable.

### 🟢 `admin-auth.ts` : cache mémoire par instance

`adminCache` Map en mémoire. En prod multi-instance Vercel, chaque instance a son propre cache → un demote sera vu par certaines instances avant d'autres. Lié au finding 🔴 #2.

### 🟢 Headers de sécurité (sauf CSP) très bien

HSTS preload OK, X-Frame-Options DENY, X-Content-Type-Options nosniff, Permissions-Policy restrictive. ✅

### 🟢 Routes cron protégées par `verifyCronAuth` (Bearer ou x-cron-secret)

`src/lib/cron-auth.ts` accepte les 2 patterns. ✅

### 🟢 `payments/[orderId]` et `payments/webhook` désactivés

Routes en `SERVICE_DISABLED` — pas de surface d'attaque. À ré-auditer dès que Stripe est implémenté.

### 🟢 `cart/add` et `cart/reserve` désactivés

Idem.

### 🟢 `webmaster/staff` revoke : protection « dernier admin » OK

`src/app/api/webmaster/staff/[userId]/route.ts:39-43`. ✅

### 🟢 `webmaster/staff` revoke : self-demotion bloquée

Idem ligne 35-38. ✅

---

## 5. Tableau récap

| # | Titre | Sévérité | Fichier:ligne | Effort fix |
|---|-------|----------|---------------|------------|
| 1 | Test-mode bypass via cookie public | 🔴 | `src/middleware.ts:17`, `src/lib/auth/server-auth.ts:9` | 4h (signature HMAC) |
| 2 | Cache rôle 5 min jamais invalidé | 🔴 | `src/middleware.ts:35`, `src/lib/admin-auth.ts:11`, `src/lib/boucher-auth.ts:51` | 2h |
| 3 | Test-mode admin sans vérif clerkId test | 🔴 | `src/lib/admin-auth.ts:20` | 30 min |
| 4 | `shops/register` ne détecte pas shop existant si ownerId=dbUser.id | 🔴 | `src/app/api/shops/register/route.ts:42` | 15 min |
| 5 | `shops/[id]/pro-requests/[proAccessId]` sans OR clause | 🔴 | `src/app/api/shops/[id]/pro-requests/[proAccessId]/route.ts:28` | 15 min |
| 6 | CSP `unsafe-inline 'unsafe-eval'` | 🔴 | `next.config.mjs:69` | 4h (nonces) |
| 7 | `proxy.ts` mort | 🟡 | `src/proxy.ts` | 5 min (suppression) |
| 8 | `users/me/location` update sans getOrCreate | 🟡 | `src/app/api/users/me/location/route.ts:26` | 10 min |
| 9 | `chat/route.ts` lookup user par clerkId | 🟡 | `src/app/api/chat/route.ts:181` | 10 min |
| 10 | `is-pro/route.ts` lookup par clerkId | 🟡 | `src/app/api/shops/[id]/is-pro/route.ts:20` | 10 min |
| 11 | `pro-request/route.ts` lookup par clerkId | 🟡 | `src/app/api/shops/[id]/pro-request/route.ts:27` | 10 min |
| 12 | `auth/check-admin` duplique requireAdmin | 🟡 | `src/app/api/auth/check-admin/route.ts:28` | 15 min |
| 13 | `getBoucherOwnerUserId` test = premier shop réel | 🟡 | `src/lib/auth/server-auth.ts:55` | (lié #1) |
| 14 | Webhook Clerk : pas idempotent | 🟡 | `src/app/api/webhooks/clerk/route.ts` | 1h |
| 15 | `admin/shops/[shopId]` owner par clerkId only | 🟡 | `src/app/api/admin/shops/[shopId]/route.ts:36` | 10 min |
| 16 | `pro-request` notify owner par clerkId only | 🟡 | `src/app/api/shops/[id]/pro-request/route.ts:71` | 10 min |
| 17 | `getServerUserId` cookie testRole non validé Zod | 🟡 | `src/lib/auth/server-auth.ts:25` | 10 min |
| 18 | `admin/users/[id]` PATCH no audit log | 🟡 | `src/app/api/admin/users/[id]/route.ts:51` | 10 min |
| 19 | `shops/register` SIRET non unique | 🟡 | `src/app/api/shops/register/route.ts` | 10 min |
| 20-25+ | Ajouts CSP nonce, audit headers, rate-limits routes publiques, etc. | 🟢 | divers | variable |

---

## Annexes

### A. Routes API par catégorie (181 total)

- 🟢 Routes publiques sans auth (volontaire) : `health`, `geo`, `shops/nearby`, `shops/[id]/products/validate`, `shops/[id]/available-slots`, `support/faq`, `suggestions`, `calendar-events`, `offers`, `webhooks/clerk` (signature Svix), `cron/**` (cron-secret), `auth/otp/**` (rate-limited mais SERVICE_DISABLED).
- 🟡 Routes désactivées (SERVICE_DISABLED) : `cart/add`, `cart/reserve`, `payments/[orderId]`, `payments/webhook`, `auth/otp/**`. À ré-auditer quand activées.
- ✅ Routes auth client : `cart`, `favorites/*`, `notifications/*`, `users/me*`, `users/upgrade-pro`, `users/pro-requests`, `recurring-orders`, `reviews`, `orders/[id]/cancel|respond|modify|rate|adjustment/**|alternatives|choose-alternatives|stream|status`, `loyalty`, `offers/validate`, `checkout/validate-code`, `push/**`, `chat`, `shops/[id]/favorite`, `shops/[id]/is-pro`, `shops/[id]/pro-request`.
- ✅ Routes auth boucher (`getAuthenticatedBoucher`) : tout `boucher/**`, `boucher/orders/[orderId]/action`, `orders/[id]/accept|deny|ready|preparing|picked-up|prep-time|stock-issue|adjust-price|scheduled-notify`, `categories/**` (+ admin bypass), `products/**` (+ admin bypass), `loyalty/config`, `support/tickets/**`, `shop/offers/**`.
- ✅ Routes admin (`requireAdmin`) : tout `admin/**`, `webmaster/**`, `dashboard/**`. Sauf `dashboard/marketing/generate-visual` à vérifier.

### B. Modèle d'ownership Shop

- `Shop.ownerId` peut contenir : (a) Clerk ID `user_xxx`, (b) Prisma User.id `cm...`. C'est documenté dans CLAUDE.md.
- `onboarding/route.ts:111` stocke `user.id` (Prisma id) → drift par rapport à `shops/register/route.ts:92` qui stocke `userId` (clerkId).
- Routes utilisant **OR clause** correctement : `shops/[id]:79`, `shops/[id]/status:38`, `products/[id]:67,174`, `products/reorder:33`, `users/pro-requests:31`, `support/tickets/[ticketId]:25-37`, `support/ai-respond:43`, `boucher-auth:78`, `getBoucherShopIds`, `orders/[id]:69`, `orders/[id]/status:89`, `orders/export:44`.
- Routes **manquantes OR clause** : `shops/register:42`, `shops/[id]/pro-requests/[proAccessId]:28`, `shops/[id]/pro-request:71`, `chat:181`, `is-pro:20`, `users/me/location:26`, `admin/shops/[shopId]:36`, `auth/check-admin:28`.
