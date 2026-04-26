# Phase 3 — Audit Sécurité Backend (API Routes Next.js)

> Klik&Go — `src/app/api/**` (181 route.ts) — Stack : Next.js 14 App Router, Zod, Clerk, Upstash Ratelimit, Prisma, Vercel Blob.
> Audit en lecture seule, aucun fix appliqué.

---

## 1. Score global sécurité backend : **7.8 / 10**

**Justification.** Très bonne base : **0 usage de `auth()` direct** dans `src/app/api/**` (tous passent par `getServerUserId` / `getAuthenticatedBoucher` / `requireAdmin`), **0 `console.log` en production** dans les routes, Prisma utilisé partout sauf 1 endpoint Haversine (paramétré via tagged template), webhooks Clerk vérifiés via Svix, headers HTTP sécurisés, CSP en place, secrets uniquement côté serveur (sauf `NEXT_PUBLIC_TEST_SECRET` voir 🔴 #1). Tenant scoping rigoureux sur les routes order/shop (vérifications `OR: [{ ownerId: clerkId }, { ownerId: dbUser.id }]`).

**Pénalités** :
- Couverture rate-limit faible (8.8 % des routes — 16/181) sur des surfaces abuse-prone (ex: `dashboard/marketing/generate-visual` Replicate, `admin/banners`, `users/me/location`).
- `NEXT_PUBLIC_TEST_SECRET` exposé au bundle client par design (testmode bypass auth → criticité élevée si secret faible ou laissé en prod).
- CSP contient `unsafe-inline` + `unsafe-eval` sur `script-src` (nécessaire pour Clerk mais affaiblit la défense XSS).
- Quelques routes `parse()` (vs `safeParse`) qui throw → traités proprement par `handleApiError` mais perdent le contexte fin.
- 1 route POST sans Zod (`src/app/api/orders/route.ts` POST) — Zod est appelé en aval dans `createOrder()`, donc validation OK *de facto*.

---

## 2. Métriques

| Métrique | Valeur | Détail |
|---|---|---|
| Routes API totales | **181** | `find src/app/api -name route.ts` |
| Routes utilisant un helper d'auth | **151 / 181 (≈ 83 %)** | `getServerUserId` / `getAuthenticatedBoucher` / `requireAdmin` |
| Routes lisant `req.json()` | 96 | |
| Routes utilisant Zod | **74** | dont 17 via `safeParse`, 86 références à `.parse()` |
| Routes avec `checkRateLimit` | **16 / 181 (≈ 8.8 %)** | voir liste section 5 |
| `auth()` Clerk direct dans `src/app/api/**` | **0** ✅ | Toutes les routes passent par les helpers |
| `console.log/info/debug` dans `src/app/api/**` | **0** ✅ | |
| `console.error` dans `src/app/api/**` | 8 occurrences | mostly fallback paths |
| Routes raw SQL (`$queryRaw`) | 1 (`shops/nearby`) + 7 (lib marketing) | tagged template, paramétré |
| Webhooks signés | 1/1 (`webhooks/clerk` via Svix) | `payments/webhook` est un placeholder désactivé |
| Cron routes protégées (`CRON_SECRET`) | 11/13 | `/api/cron` (master) et `/api/cron/recipes` ont leur propre logique inline (équivalente) |
| Headers HSTS / X-Frame / Referrer / Permissions / CSP | ✅ tous présents | `next.config.mjs` |
| Routes API renvoyant des CORS headers | 0 (same-origin SPA — OK) | |

---

## 3. Findings critiques 🔴

### 🔴 #1 — `NEXT_PUBLIC_TEST_SECRET` bake en clair dans le bundle client → bypass total de Clerk
📁 Fichier : `src/lib/auth/test-auth.ts:44`, `src/lib/auth/server-auth.ts:1-30`, `src/lib/admin-auth.ts:18-26`, `src/lib/boucher-auth.ts:24-43`
🐛 Le secret de testmode est lu via `process.env.NEXT_PUBLIC_TEST_SECRET`, donc embarqué dans le JS client à chaque build. Toute personne sur la prod peut le récupérer (`view-source` / DevTools → Network) puis appeler `?testmode=<secret>` qui set les cookies `klikgo-test-activated=true` et `klikgo-test-role=ADMIN`.
   - `getServerUserId()` (server-auth.ts:24) court-circuite `auth()` Clerk si `klikgo-test-activated=true`.
   - `requireAdmin()` (admin-auth.ts:18-26) renvoie un userId admin valide et **bypasse Clerk**.
   - `getAuthenticatedBoucher()` (boucher-auth.ts:25-43) idem : retourne le `ownerId` de la première shop trouvée (lecture totale + écriture sur N'IMPORTE quelle boutique).
💥 Si `NEXT_PUBLIC_TEST_MODE=true` sur la prod (klikandgo.app), c'est compromission totale : impersonation ADMIN, lecture/modification de toutes les commandes, modification des prix, suppression d'images, etc. Le CLAUDE.md indique `NEXT_PUBLIC_TEST_MODE=true` côté Vercel.
✅ Vérifier d'urgence l'état de `NEXT_PUBLIC_TEST_MODE` sur la prod Vercel ; si actif → désactiver immédiatement, ou faire passer test-mode sur un secret **server-only** (pas `NEXT_PUBLIC_`) avec activation par un endpoint POST signé.

### 🔴 #2 — `dashboard/marketing/generate-visual` appelle Replicate sans rate-limit
📁 Fichier : `src/app/api/dashboard/marketing/generate-visual/route.ts:21-30`
🐛 Route admin protégée par `requireAdmin()` mais aucun `checkRateLimit`. Un admin compromis (ou un script en boucle dans un onglet ouvert) peut générer des images Replicate sans plafond — coût direct $$ / minute.
💥 Coût AI illimité ; pas de protection contre une boucle infinie côté client.
✅ Ajouter `checkRateLimit(rateLimits.ai, ...)` comme dans `admin/images/generate/route.ts:30`.

---

## 4. Findings importants 🟡

### 🟡 #3 — Couverture rate-limit globale très faible (8.8 %)
📁 Fichier : `src/lib/rate-limit.ts` (buckets définis OK)
🐛 Seulement 16/181 routes appellent `checkRateLimit`. Routes sensibles non protégées :
   - `src/app/api/users/me/location/route.ts:17` — PATCH coordonnées GPS (peut être spammé pour stress test DB)
   - `src/app/api/notifications/route.ts` GET — abus possible (polling)
   - `src/app/api/favorites/toggle/route.ts:13` — toggle illimité
   - `src/app/api/cart/route.ts` — opérations panier
   - `src/app/api/auth/me/route.ts` — fait un Prisma lookup sur chaque appel
   - `src/app/api/admin/banners/route.ts` POST/PATCH/DELETE
   - `src/app/api/admin/calendar/route.ts`
   - `src/app/api/webmaster/flags/route.ts`
   - `src/app/api/orders/[id]/status/route.ts` — endpoint poll-friendly, aucune limite par client
💥 Surfaces d'abus : DoS léger, scraping, force pour leak via timing.
✅ Étendre `rateLimits.api` aux routes mutantes par défaut, ajouter `rateLimits.search` aux GETs de polling.

### 🟡 #4 — `req.json()` sans Zod direct en POST `/api/orders`
📁 Fichier : `src/app/api/orders/route.ts:42-46`
🐛 La route fait `const body = await req.json()` puis `createOrder(body, userId)`. Le service `createOrder` (`src/lib/services/orders/create.ts:46-54`) parse bien avec `createOrderSchema.safeParse(body)`, mais il y a un accès non-typé `bodyRecord.idempotencyKey` AVANT le parsing schema. Si un body avec un type inattendu est passé (ex: object), le branche idempotency renverrait un order existant.
💥 Faible — `findUnique({ idempotencyKey })` exigerait quand même une string. Mais le contrat de validation devrait être en haut.
✅ Déplacer le `safeParse` avant la lookup idempotency.

### 🟡 #5 — `src/app/api/cart/add/route.ts:39` `console.error` en clair (toléré mais hors logger)
📁 Fichier : `src/app/api/cart/add/route.ts:39`
🐛 Utilise `console.error("[cart/add]", error)` au lieu du `logger.error(...)`. Acceptable côté Sentry mais incohérent avec le reste de la base.
💥 Aucun PII loggé (l'erreur est un objet Error standard) — non bloquant.
✅ Standardiser sur `logger.error`.

### 🟡 #6 — `auth/me` GET fait un Prisma lookup à chaque appel sans cache ni rate-limit
📁 Fichier : `src/app/api/auth/me/route.ts:9-26`
🐛 Polling potentiel par les composants client → chaque appel fait `prisma.user.findUnique` + Clerk RPC. Pas de rate-limit ni cache.
💥 DB pressure sous charge ; pas de DoS direct mais coût.
✅ Cache 30 s côté Redis indexé sur `clerkId`.

### 🟡 #7 — `admin-auth.ts` & `boucher-auth.ts` utilisent `auth()` Clerk direct (autorisé, mais hors guideline)
📁 Fichier : `src/lib/admin-auth.ts:31` et `src/lib/boucher-auth.ts:46`
🐛 CLAUDE.md interdit explicitement `import { auth } from "@clerk/nextjs/server"` côté API. Ici c'est dans des helpers (compatible test-mode car wrappés derrière `isTestActivated()`), mais ce sont les seuls usages restants. Pas un bug mais une dette de cohérence.
💥 Aucun.
✅ Documenter l'exception ou refactorer pour passer par un wrapper unique.

### 🟡 #8 — Suggestions / FAQ / search publics renvoient des productIds non scopés tenant
📁 Fichier : `src/app/api/suggestions/route.ts:10-25`
🐛 La route est publique (pas d'auth) et accepte `productIds` arbitraires + `shopId`. La requête `prisma.suggestRule.findMany({ shopId, sourceProductId: { in: cartProductIds } })` filtre bien par shopId, donc OK. Mais le param `productIds` n'est pas validé Zod (`split(",")`).
💥 Faible — IN clause sur strings sans validation. Pas d'injection (Prisma) mais possibilité de payloads géants → un `productIds=a,a,a,...` × 10k bloquerait Prisma.
✅ Limiter `cartProductIds.length` à ~50.

### 🟡 #9 — `chat` route passe le contenu utilisateur direct à Anthropic (max 5000 chars × 50 messages)
📁 Fichier : `src/app/api/chat/route.ts:11-23`
🐛 250 KB de texte par requête × rate-limit de 3/min → couvert. Pas de scrubbing PII avant envoi LLM.
💥 RGPD : si l'utilisateur tape email/téléphone, c'est envoyé à Anthropic.
✅ Documenter dans la politique de confidentialité ou scrubber.

---

## 5. Findings améliorations 🟢

### 🟢 #10 — `z.string()` sans `.max()` sur certaines clés
📁 Fichiers :
   - `src/app/api/chat/route.ts:16-17` — `name: z.string()`, `unit: z.string()` (les autres champs sont contraints, mais ces deux ne le sont pas)
   - `src/app/api/checkout/validate-code/route.ts:13` — `cartProductIds: z.array(z.string())` (pas de longueur max)
   - `src/app/api/boucher/orders/[orderId]/action/route.ts:25` — `z.string()` dans une enum-like
   - `src/app/api/admin/calendar/route.ts:29` — `date: z.string().datetime()` (datetime() valide)
🐛 Pas critique, mais payloads géants théoriques.
✅ Ajouter `.max(200)` partout.

### 🟢 #11 — `payments/webhook` placeholder, pas de signature Stripe
📁 Fichier : `src/app/api/payments/webhook/route.ts`
🐛 N'existe que comme placeholder désactivé — Stripe n'est pas implémenté (cf. CLAUDE.md). À surveiller pour la mise en place future.
✅ Quand Stripe sera intégré : `stripe.webhooks.constructEvent(rawBody, sig, secret)` obligatoire.

### 🟢 #12 — `shops/nearby` raw SQL : Haversine bien paramétré mais à surveiller
📁 Fichier : `src/app/api/shops/nearby/route.ts:43-86`
🐛 `prisma.$queryRaw` avec tagged template literal → 100 % paramétré (`${lat}` deviennent des placeholders Postgres). Aucun risque SQLi. ✅
💥 Vigilance si quelqu'un refactore vers `$queryRawUnsafe` un jour.
✅ Commenter le risque ; ajouter test ESLint qui interdit `$queryRawUnsafe` / `$executeRawUnsafe`.

### 🟢 #13 — CSP `unsafe-inline` + `unsafe-eval` sur `script-src`
📁 Fichier : `next.config.mjs:54-66`
🐛 Requis par Clerk + Cloudflare Turnstile. Dégrade la défense XSS.
✅ Migrer vers nonces si Clerk les supporte un jour ; pour Turnstile, isoler dans une iframe hostée.

### 🟢 #14 — `image proxy` (boucher) — SSRF defense en place ✅
📁 Fichier : `src/app/api/boucher/images/proxy/route.ts:7-30`
✅ Whitelist `ALLOWED_HOSTS` + `https:` only + `MAX_BYTES` 5 MB + timeout 8 s. Bonne hygiène.

### 🟢 #15 — `uploads/product-image` — robuste ✅
📁 Fichier : `src/app/api/uploads/product-image/route.ts`
✅ MIME whitelist + magic bytes + max 2 MB + max 5 images/produit + ownership check + sharp resize. Très bien.

### 🟢 #16 — `handleApiError` ne fuit pas la stack trace au client ✅
📁 Fichier : `src/lib/api/errors.ts:155`
✅ `error.stack` est uniquement loggé via `console.error` (visible Sentry), jamais renvoyé dans la réponse JSON. Le client reçoit juste le code + message.

### 🟢 #17 — Erreurs Prisma mappées proprement ✅
📁 Fichier : `src/lib/api/errors.ts:131-148`
✅ "Record to update not found" → `NOT_FOUND` 404 ; "Unique constraint" → `CONFLICT` 409 ; erreurs connexion DB → 500 générique. Pas de leak du message Prisma.

### 🟢 #18 — Webhook Clerk Svix bien vérifié ✅
📁 Fichier : `src/app/api/webhooks/clerk/route.ts:30-58`
✅ Svix verify avec rejet 400 si headers manquants, 401 si signature invalide. Soft-delete au lieu de hard-delete (préserve les commandes).

### 🟢 #19 — Cron routes protégées ✅
📁 Fichier : `src/lib/cron-auth.ts`
✅ `verifyCronAuth()` accepte `Authorization: Bearer <CRON_SECRET>` (Vercel Crons) OU `x-cron-secret`. 11/13 routes l'utilisent ; les 2 autres (`/api/cron` master + `/api/cron/recipes`) ont une logique équivalente inline.

### 🟢 #20 — Tenant scoping order : vérification OR clauses correcte ✅
📁 Fichier : `src/app/api/orders/[id]/status/route.ts:78-91`, `src/app/api/orders/[id]/cancel/route.ts:31-38`
✅ Vérifie `order.user.clerkId !== userId` PUIS shop ownership en deuxième passe avec `OR: [ownerId clerkId, ownerId dbUser.id]` — correct multi-tenant.

### 🟢 #21 — `secret` dans logs : aucun trouvé ✅
✅ `grep -E "logger.*(password|token|secret)"` → 0 résultat. `grep -E "console.*(password|secret)"` → 0 résultat.

### 🟢 #22 — `NEXT_PUBLIC_*` sensibles : test secret seulement ✅
✅ Seul `NEXT_PUBLIC_TEST_SECRET` matche (cf. 🔴 #1). Aucun `NEXT_PUBLIC_*_KEY`/`_TOKEN` à part Clerk publishable et Plausible domain (acceptables).

### 🟢 #23 — CORS : aucune route ne renvoie `Access-Control-Allow-*` ✅
✅ Cohérent avec une SPA same-origin sur klikandgo.app — aucun risque CORS-misconfig.

### 🟢 #24 — Headers HTTP sécurité tous présents ✅
✅ `next.config.mjs:30-65` : HSTS (preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrictive, CSP.

---

## 6. Tableau récap

| Aspect | Note | Commentaire |
|---|---|---|
| Validation Zod | 🟡 Bon | 74 routes Zod / 96 routes JSON ; quelques `.string()` sans `.max()` |
| Rate-limiting | 🔴 Faible | 8.8 % de couverture, gaps abuse-prone (Replicate admin sans RL) |
| Auth/Authorization | 🟢 Excellent | 0 `auth()` direct, helpers cohérents, tenant scope solide |
| SQL Injection | 🟢 Excellent | 100 % Prisma ; 1 `$queryRaw` paramétré |
| CSRF | 🟢 Bon | Clerk Lax cookies + state-changing routes auth |
| CORS | 🟢 Bon | Same-origin SPA, pas de header laxiste |
| Secrets | 🔴 Critique | `NEXT_PUBLIC_TEST_SECRET` bake client-side → bypass total |
| Webhooks | 🟢 Excellent | Svix Clerk vérifié ; payments désactivé |
| Logs | 🟢 Excellent | 0 `console.log` en API, logger conditionnel prod |
| Headers HTTP | 🟢 Excellent | HSTS, XFO, CSP (avec quelques `unsafe-*` Clerk-required) |
| Erreurs (stack) | 🟢 Bon | Pas de leak vers le client |
| Couverture cron auth | 🟢 Excellent | 13/13 protégés (2 inline, 11 via helper) |

---

## TL;DR — Top 3 actions

1. **🔴 #1 critique** : Vérifier que `NEXT_PUBLIC_TEST_MODE` est désactivé en prod (Vercel env). Si activé → désactiver immédiatement OU migrer le secret côté server-only. Le bypass admin est trivial sinon.
2. **🔴 #2** : Ajouter `checkRateLimit(rateLimits.ai, ...)` à `dashboard/marketing/generate-visual` (cost control Replicate).
3. **🟡 #3** : Étendre la couverture rate-limit aux routes de polling (`auth/me`, `notifications`, `orders/[id]/status`) et aux mutations admin (`banners`, `calendar`, `flags`).
