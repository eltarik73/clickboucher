---
name: clerk-auth
description: Authentification Clerk dans Klik&Go telle qu'elle est câblée (Clerk 6.39.9 / Core 2, Next 14.2.35). Middleware en liste blanche et pièges de createRouteMatcher, helpers serveur obligatoires (getServerUserId, getAuthenticatedBoucher, requireAdmin), rôles stockés en base avec miroir dans les metadata Clerk et trois caches, webhook Clerk et synchronisation des utilisateurs, comportement de session sur pages statiques (isLoaded), mode test à jeton signé, comptes invités, trajectoire vers Core 3. À charger avant de toucher src/middleware.ts, src/lib/auth/**, boucher-auth.ts, admin-auth.ts, roles.ts, le webhook Clerk, une page de connexion, ou toute route qui lit l'identité ou change un rôle.
when_to_use: 401, 403 ou 404 inattendu ; boucle de redirection ; erreur "auth() was called but Clerk can't detect usage of clerkMiddleware()" ; nouvelle famille de pages protégées ; changement de rôle qui ne prend pas effet ; utilisateur absent de la base après inscription ; webhook Clerk en échec ; useAuth() ou useUser() vides au premier rendu ; clés pk_test en production ; mode test ; avis de sécurité Clerk ; question sur la montée vers @clerk/nextjs 7.
---

# Clerk Auth — Klik&Go

Versions installées (vérifiées dans `node_modules` les 2026-11-13 et 14) : `@clerk/nextjs` **6.39.9**
(Core 2, dernière de la ligne v6), `@clerk/backend` 2.33.9, `@clerk/shared` 3.48.1, Next 14.2.35.
Ce skill décrit **notre** câblage (HEAD 32c581f, chantier prix en cours non commité), pas le
quickstart Clerk. Les numéros de ligne datent du 2026-11-14 : en cas d'écart, chercher le symbole. `CLAUDE.md` gagne toujours ; tout écart entre l'état de l'art et nos règles va
dans « Points à arbitrer ». Sources : [references/sources.md](references/sources.md)
(`[C…]` externe, `[L…]` code ou audit local).

Skills voisins, à ne pas dupliquer : `security-multitenant` (autorisation, IDOR, check-list de route),
`nextjs-app-router` (rendu statique/dynamique), `vercel-cost-performance` (coût du middleware),
`api-route-conventions` (forme des handlers), `testing-strategy`.

## 1. Carte de l'auth dans le code

| Fichier | Rôle | À savoir |
|---|---|---|
| `src/middleware.ts` | Redirection **optimiste** des pages protégées + session Clerk pour l'API | `config.matcher` = liste blanche ; hors matcher, `auth()` lève |
| `src/lib/auth/server-auth.ts` | `getServerUserId()`, `getBoucherOwnerUserId()`, `resolveUserRole()`, `getTestRole()` | Seul endroit (avec les deux suivants) autorisé à importer `auth` |
| `src/lib/boucher-auth.ts` | `getAuthenticatedBoucher()` → `{ userId, shopId }` ou `{ error }` | `userId` = id **Prisma** ; cache mémoire + Redis 60 s |
| `src/lib/admin-auth.ts` | `requireAdmin()` → `{ userId }` ou `{ error }` ; `assertShopAccess()` | `userId` = id **Clerk** ; lit d'abord les metadata Clerk (§ 5) |
| `src/lib/roles.ts` | `isAdmin()`, `isBoucher()` (insensibles à la casse, `webmaster` = admin) | `isBoucher()` est vrai aussi pour un admin |
| `src/lib/auth/role-cache.ts` | `invalidateRoleCache(clerkId)` | Purge Redis seulement, pas les `Map` par instance |
| `src/lib/auth/test-mode-env.ts` | `isTestModeEnabled()`, `isProductionDeployment()` | Règle unique : jamais de mode test en production Vercel |
| `src/lib/auth/test-session.ts` / `test-session-node.ts` | Jeton de test signé HMAC-SHA256 (edge / Node) | Seule preuve acceptée en mode test |
| `src/lib/auth/guest-auth.ts` | Invités : cookie httpOnly `klikgo-guest-token` | `User.clerkId = null`, `guestToken` unique |
| `src/lib/get-or-create-user.ts` | Rattrapage si le webhook n'a pas (encore) créé l'utilisateur | Appelle l'API Clerk |
| `src/app/api/webhooks/clerk/route.ts` | Sync `user.created/updated/deleted` → table `User` | Hors matcher ; vérifié par signature Svix |
| `src/lib/__tests__/middleware-matcher.test.ts` | Verrouille matcher ↔ règles ↔ imports des handlers exclus | À mettre à jour avec le middleware |

## 2. Les règles qui décident

1. **La frontière de sécurité est le handler, pas le middleware.** Le middleware redirige tôt et
   rafraîchit la session ; chaque route API et chaque Server Component qui lit une donnée protégée
   refait le contrôle. Clerk (« Middleware is not the best place to protect routes ») et Next.js
   (le Proxy « should not be your only line of defense ») le disent tous deux [C1][C19], et deux
   contournements réels l'ont montré (CVE-2025-29927 côté Next, GHSA-vqx2-fgx2-5wq9 côté Clerk)
   [C20][C4]. Chez nous c'est vital : les layouts `(admin)`, `(boucher)` et `webmaster` n'ont
   **aucune** garde serveur [L2] — seules les API protègent les données.
2. **Jamais `auth()` ni `currentUser()` dans une route ou une page.** Passer par
   `getServerUserId()` / `getAuthenticatedBoucher()` / `requireAdmin()`. Raison : avec une session
   de test valide le middleware sort avant `clerkMiddleware`, donc `auth()` lèverait ; les helpers
   vérifient d'abord le jeton de test signé (`server-auth.ts:19-45`).
3. **Le rôle fait foi en base** (`User.role`), jamais dans `sessionClaims` (supprimé chez nous) ni
   dans `publicMetadata` lu côté client. `user.publicMetadata.role` dans un composant sert à
   l'affichage, pas à autoriser.
4. **Deux identifiants, ne pas les confondre.** `getServerUserId()` renvoie l'id **Clerk**
   (`user_…`) ; les clés étrangères (`Order.userId`, `LoyaltyReward.userId`) portent l'id **Prisma**
   (`cm…`). `Shop.ownerId` peut contenir l'un ou l'autre → toujours la clause `OR` de `CLAUDE.md`.
5. **Nouvelle famille protégée = trois écritures** : la liste `createRouteMatcher`, `config.matcher`
   (mêmes littéraux), et le test `middleware-matcher.test.ts`. Détail et pièges :
   [references/middleware-matcher.md](references/middleware-matcher.md).
6. **Un handler hors matcher n'importe jamais** `server-auth`, `boucher-auth` ni `admin-auth`
   (le test le vérifie par fermeture d'imports). Il s'authentifie autrement : signature (webhooks),
   `verifyCronAuth` (crons), ou il est public.
7. **Côté client, `isLoaded` avant tout.** Sans la prop `dynamic` (interdite), l'état d'auth
   n'existe qu'après chargement de clerk-js. Tout appel API au montage est conditionné par
   `(isLoaded && isSignedIn) || hasTestModeCookie()` et les flags sont dans les dépendances de l'effet.
8. **Le webhook est asynchrone, non garanti, non ordonné** [C9][C10]. Aucun parcours synchrone
   (onboarding, première commande) ne suppose que `User` existe déjà : `getOrCreateUser()` ou
   création dans la route.
9. **Changer un rôle = base + metadata Clerk + `invalidateRoleCache()`**, dans cet ordre, dans la
   même route (modèle : `src/app/api/admin/users/[id]/route.ts:52-72`), plus l'entrée d'audit.
   Jamais la base seule : le webhook `user.updated` recopie le rôle des metadata dans la base.
10. **Le mode test n'est jamais une échappatoire.** Ne jamais réintroduire un contournement fondé
    sur un cookie lisible, une variable d'environnement seule ou une valeur venue du client (§ 6).

## 3. Quel helper pour quelle route

| Besoin | Appel | Retour | Ensuite |
|---|---|---|---|
| Savoir qui appelle (client) | `await getServerUserId()` | id Clerk ou `null` | `401` si `null` ; résoudre l'id Prisma avant toute comparaison |
| Route boucher | `await getAuthenticatedBoucher()` | `{ userId, shopId }` \| `{ error }` | `if (auth.error) return auth.error;` puis **`shopId` dans chaque `where`** |
| Route admin / webmaster | `await requireAdmin()` | `{ userId }` \| `{ error }` | `if (admin.error) return admin.error;` + `writeAuditLog` sur mutation |
| Rôle seul (rare) | `await resolveUserRole()` | rôle DB ou `undefined` | en mode test ne renvoie que `"admin"` ou `undefined` |
| Propriétaire en mode test | `await getBoucherOwnerUserId()` | `ownerId` réel de la 1re boutique | uniquement pour comparer à `shop.ownerId` |
| Invité | `await getGuestUser()` | `User` invité ou `null` | jamais mélangé à un compte Clerk ; helper sans appelant aujourd'hui (`/suivi/[id]` lit le cookie lui-même) : l'utiliser pour toute nouvelle route invité |
| Cron | `verifyCronAuth(req)` | booléen | `401` sinon |

Patrons complets, compilés contre nos versions : [references/patterns.md](references/patterns.md).
Les fabriques de route visées par `api-route-conventions` (`boucherRoute`, `adminRoute`…, pas
encore créées) appelleront ces mêmes helpers : ce tableau reste la référence.

## 4. Middleware : ce qu'il garantit, ce qu'il ne garantit pas

- Garantit : redirection des anonymes hors de `/admin`, `/webmaster`, `/boucher`, `/checkout`,
  `/commandes`, `/profil`, `/chat`, `/onboarding` ; contexte Clerk pour `/api/**` (sauf exclusions) ;
  `400` sur `%2F`/`%5C` et sur encodage invalide.
- Ne garantit pas : l'autorisation des données (c'est l'API), ni la protection d'une page dont le
  chemin n'est pas dans `config.matcher` — **le matcher gagne sur les règles**.
- Le rôle y est lu dans `publicMetadata` via `clerkClient().users.getUser()` (appel à l'API
  Backend, limitée à 1000 req / 10 s en production et 100 en développement [C12]) puis mis en
  cache Redis 60 s. Un rôle rétrogradé en base seulement reste donc accepté par le middleware.
- Motifs : écrire `["/x", "/x/(.*)"]`, jamais `"/x(.*)"` — ce dernier attrape aussi `/x-autre-chose`
  (notre bug `/boucher(.*)` ↔ `/boucheries-halal…`, documenté par Clerk en 7.5.13 [C3]). Les quatre
  motifs de `isProtectedRoute` ont encore l'ancienne forme (`middleware.ts:36-41`).

## 5. Rôles : où ils vivent, combien de temps ils mentent

| Lecteur | Source | Cache | Fenêtre de péremption |
|---|---|---|---|
| Middleware (pages) | metadata Clerk | Redis `role:<clerkId>` 60 s (ou `Map`) | ≤ 60 s après invalidation Redis |
| `getAuthenticatedBoucher` | base | `Map` 60 s puis Redis `boucher:auth:<clerkId>` 60 s | ≤ 60 s par instance chaude |
| `requireAdmin` | metadata Clerk **puis** base | `Map` 60 s | ≤ 60 s par instance chaude |
| `/admin-login` | metadata Clerk | aucun | immédiat |

Vocabulaire : base en majuscules (`ADMIN`, `BOUCHER`, `CLIENT`, `CLIENT_PRO`,
`CLIENT_PRO_PENDING`), metadata en minuscules. `webmaster` est accepté par `isAdmin()` et par le
middleware mais **absent** du `ROLE_MAP` du webhook : ne jamais l'écrire dans les metadata.
Détail, écriture canonique et défauts connus : [references/roles-et-synchronisation.md](references/roles-et-synchronisation.md).

## 6. Mode test (depuis 2364ef9, 2026-11-13)

- **Impossible en production Vercel** : `isTestModeEnabled()` renvoie `false` si
  `VERCEL_ENV=production` ou si `KLIKGO_DEPLOY_ENV` (figée au build par `next.config.mjs:9-11`)
  vaut `production`, quelles que soient `TEST_MODE` / `ALLOW_TEST_IN_PROD`.
- **Seule preuve acceptée** : cookie httpOnly `klikgo-test-session`, jeton `v1.<payload>.<hmac>`
  (rôle + expiration 8 h) signé avec `TEST_SECRET` (≥ 16 caractères), vérifié en temps constant
  (Web Crypto dans le middleware, `node:crypto` dans les helpers). `klikgo-test-activated` et
  `klikgo-test-role` ne sont que des indices d'interface.
- Activation par `POST /api/test-mode/activate` (secret comparé par `secretsMatch`, limité par
  `rateLimits.otpVerify`), changement de rôle par `PATCH`, fermeture par `DELETE`.
- En mode test, ni `clerkMiddleware` ni `auth()` ne tournent, et BOUCHER/ADMIN reçoivent la
  **première boutique créée** : un parcours validé en mode test n'est pas validé pour le vrai Clerk.
- Tests : `src/lib/__tests__/test-session.test.ts` croise les deux implémentations ; toute
  modification de ce format passe par lui.

## 7. Session et pages statiques

- Jeton de session : cookie `__session`, 60 s, rafraîchi toutes les 50 s par le SDK ; la session
  longue vit sur le domaine Clerk (`__client`, httpOnly) [C11].
- Une page **hors matcher** est servie sans Clerk côté serveur : l'état d'auth n'existe qu'après
  chargement de clerk-js. C'est voulu (pages publiques statiques, coût CPU).
- Jeton expiré sur une requête **document** d'une page **dans** le matcher : `clerkMiddleware` fait
  le « handshake » et la page repart avec un jeton frais [C11]. Hors matcher, le premier `fetch`
  authentifié partirait avec un jeton périmé → règle 7, et présence de `/commande/(.*)`,
  `/shop/offers`, `/dashboard/marketing` dans le matcher.
- Révocation (déconnexion, bannissement) : le jeton déjà émis reste vérifiable localement jusqu'à
  son expiration (déduction du modèle à 60 s [C11], non chiffrée par la doc).
- Détail : [references/sessions-et-rendu.md](references/sessions-et-rendu.md).

## 8. Erreurs déjà commises ici

| Erreur | Effet | Garde-fou / état |
|---|---|---|
| `"/boucher(.*)"` dans le matcher | 307 sur toutes les pages SEO `/boucheries-halal…` | motifs stricts, commentaire `middleware.ts:28-31` |
| Matcher « tout sauf les assets » | coût CPU du middleware, panne du 2026-11-05 | liste blanche + test |
| Matcher excluant par extension | `/admin/shops/x.css` servait la coquille admin sans middleware [L2] | corrigé par la liste blanche |
| Clerk 6.37.3 + `if (matcher(req))` | contournement `/%61dmin/…` (GHSA-vqx2-fgx2-5wq9, critique) [C4] | 6.39.9 + entrée percent-encodée du matcher |
| `isPublicRoute(req)` appelé hors `clerkMiddleware` | `MalformedURLError` non rattrapée → 500 sur `/boutique/%` [L3] | `try/catch` → 400 (`middleware.ts:220-226`) |
| `<ClerkProvider dynamic>` | 298 routes sur 308 dynamiques | interdit (`CLAUDE.md`), commentaire `src/app/layout.tsx:146` |
| Mode test : `TEST_MODE` + `ALLOW_TEST_IN_PROD` en prod et deux cookies en clair | n'importe quel visiteur devenait ADMIN (jusqu'au 2026-11-13) | jeton signé + interdiction en prod (2364ef9) [L5] |
| `currentUser().publicMetadata.role` dans les routes | rôle périmé si le webhook échoue | remplacé par la base ; **reste** dans `admin-auth.ts:41-48` et `admin-login/page.tsx:24-25` |
| `fetch` authentifié au montage sans attendre Clerk | 401 silencieux, panier non restauré | règle 7 |

Défauts **encore présents** (à corriger par l'équipe qui touchera ces fichiers, pas à reproduire) :
clé d'idempotence du webhook posée avant le traitement (un échec transitoire perd l'événement) ;
`user.created` en `create` et non `upsert` ; `user.updated` qui réécrit en base le rôle lu dans les
metadata ; invalidation de cache absente de 5 routes qui changent un rôle, et aucune qui annule
l'écriture en base si la mise à jour Clerk échoue ; `GET /api/test-mode/activate?secret=` accepte
encore le secret en query string (préproduction et local seulement). Détail, lignes et correctifs :
[references/roles-et-synchronisation.md](references/roles-et-synchronisation.md).

## 9. Trajectoire Core 3 (`@clerk/nextjs` 7)

Bloquée tant que Next < 15.2.8 : la 7.10.0 (`latest` au 2026-11-14) exige Next
`^15.2.8 ‖ … ‖ ^16.0.10…` et Node ≥ 20.9 [C22]. À savoir **dès maintenant** pour ne pas creuser la dette :

- `createRouteMatcher()` est **déprécié depuis 7.5.14** ; Clerk demande de contrôler chaque page,
  route et Server Function, `clerkMiddleware()` et `config.matcher` restant requis [C2][C3].
  Tout nouveau code met donc le contrôle dans le handler (règle 1).
- `<ClerkProvider>` devra être **dans** `<body>` (il enveloppe `<html>`, `src/app/layout.tsx:151`) ;
  `UserButton afterSignOutUrl` disparaît (2 usages) ; `<SignedIn>/<SignedOut>/<Protect>` → `<Show>`
  (aucun usage chez nous) [C8].
- Planchers de sécurité sur la ligne v6 : `@clerk/nextjs` ≥ 6.39.3, `@clerk/shared` ≥ 3.47.5,
  `@clerk/backend` ≥ 2.33.9 [C4][C5][C6]. Nous y sommes ; ne jamais redescendre. Base d'avis
  GitHub au 2026-11-14 : aucun avis ouvert sur nos trois versions
  (`gh api "/advisories?ecosystem=npm&affects=@clerk/nextjs@6.39.9"`) — relancer avant toute montée.
- Plan pas à pas et inventaire : [references/core3-migration.md](references/core3-migration.md).

## 10. Points à arbitrer (propriétaire)

1. **Garde serveur des back-offices.** Clerk, Next.js et OWASP [C2][C19][C23] veulent un contrôle
   dans chaque page protégée. Nos pages admin/boucher/webmaster sont des coquilles client sans
   donnée ; une garde serveur les rend dynamiques (une fonction par navigation), ce qui touche la
   règle de coût CPU. Proposition : garder les coquilles, tenir la règle 1 sans exception, n'ajouter
   une garde serveur qu'à une page qui lit des données côté serveur.
2. **Source du rôle dans le middleware, `requireAdmin` et le webhook.** Les deux premiers lisent
   les metadata Clerk et le webhook les recopie en base, alors que `CLAUDE.md` dit que la base fait
   foi. Un admin rétrogradé en base seulement garde l'accès, puis retrouve son rôle en base au
   prochain `user.updated`. Options : (a) `requireAdmin` lit la base d'abord et le webhook cesse
   d'écrire `role` ; (b) le middleware lit le rôle dans un claim du jeton (zéro appel réseau,
   documenté par Clerk [C15]) — mais `CLAUDE.md` a retiré `sessionClaims`.
3. **`authorizedParties`.** Clerk le dit « highly recommended » en production [C16] ; absent de
   notre `clerkMiddleware`. À activer piloté par variable d'environnement (les previews ont une
   autre origine). Gain réel mais partiel en Core 2 : un jeton sans claim `azp` passe quand même.
4. **Supprimer `GET /api/test-mode/activate`** (secret en query string, contraire à ASVS 14.2.1
   [C25]) et ne garder que le `POST` documenté dans `CLAUDE.md`.
5. **`verifyWebhook` de `@clerk/nextjs/webhooks`** (présent en 6.39.9) à la place de `svix` direct :
   même vérification, moins de code ; Clerk attend `CLERK_WEBHOOK_SIGNING_SECRET`, la nôtre
   s'appelle `CLERK_WEBHOOK_SECRET` (passable en option `signingSecret`) [C9][L1].

## 11. Définition de terminé (travail touchant l'auth)

- [ ] Aucune importation de `auth`/`currentUser` hors `src/lib/auth/server-auth.ts`,
      `boucher-auth.ts`, `admin-auth.ts`, `admin-login/page.tsx`
      (`rg "from \"@clerk/nextjs/server\"" src` ne montre que cette liste, des types et `clerkClient`).
- [ ] Toute route nouvelle commence par le bon helper du § 3 et renvoie son `error` tel quel.
- [ ] Famille protégée ajoutée : `createRouteMatcher` + `config.matcher` + test, motifs stricts.
- [ ] Route exclue du matcher : n'atteint aucun helper Clerk (le test passe).
- [ ] Changement de rôle : base, `updateUserMetadata`, `invalidateRoleCache`, entrée d'audit.
- [ ] Composant client : `isLoaded` testé, aucun appel API au montage pour un anonyme.
- [ ] Parcours vérifié en mode test **et** raisonné pour le vrai Clerk.
- [ ] Rien n'élargit le mode test (`test-mode-env.ts`, `test-session*.ts` inchangés ou revus à part).
- [ ] `npm run test` vert (dont `middleware-matcher` et `test-session`), `npm run build` vert,
      pages publiques toujours prérendues (`scripts/check-prerender.mjs`).
- [ ] Essais déconnectés sur une préproduction : `/admin`, `/boucher/dashboard`, `/checkout`
      redirigent ; `/%61dmin/dashboard` et `/admin%2Fdashboard` ne servent jamais la coquille ;
      l'API de la fonctionnalité répond 401 sans session et 403/404 avec le mauvais rôle.

## Références

- [references/middleware-matcher.md](references/middleware-matcher.md) — anatomie, classes de contournement, procédures d'ajout.
- [references/roles-et-synchronisation.md](references/roles-et-synchronisation.md) — rôles, caches, webhook, invités, défauts connus.
- [references/sessions-et-rendu.md](references/sessions-et-rendu.md) — jeton, handshake, pages statiques, production.
- [references/core3-migration.md](references/core3-migration.md) — plan de montée et inventaire.
- [references/patterns.md](references/patterns.md) — code prêt à copier, compilé contre nos versions.
- [references/sources.md](references/sources.md) — sources, crédibilité, date d'accès.
