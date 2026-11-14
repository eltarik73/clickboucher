# Sources et preuves — api-route-conventions

Sources externes consultées les **2026-11-13 et 2026-11-14** (relecture complète le 14). `[S…]` =
source externe, `[L…]` = preuve locale reproductible dans le dépôt (`HEAD 32c581f` + arbre de travail
du chantier prix). Étoiles et dernier push relevés le 2026-11-14 par
`gh api repos/OWNER/REPO --jq '{stars:.stargazers_count,pushed:.pushed_at,archived:.archived}'`.
Ce qui n'a pas pu être vérifié, ou n'est établi que sans mesure, est listé en fin de fichier.
Vérification indépendante le 2026-11-14 : S1 à S23, S12b et S29 rouverts à la source citée (S24 :
existence du fichier seulement ; S25 et S26 non rouverts — ils n'appuient que des approches
écartées), étoiles remesurées, preuves locales rejouées sur l'arbre de travail ; corrections
reportées ci-dessous.

## Documentation officielle et normes

| Id | Source | Ce qu'elle appuie | Crédibilité |
| --- | --- | --- | --- |
| S1 | Next.js 14 — Route Handlers · https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers | Méthodes supportées et 405 automatique ; `GET` mis en cache par défaut en 14 et ce qui l'annule (objet `Request`, autre méthode, `cookies()`/`headers()`, config de segment) ; `params` objet simple en 14 ; `request.json()` / `formData()` / `text()` | Doc officielle (Vercel), version 14, mise à jour 2024-02-23 — relue le 2026-11-14 |
| S2 | Next.js 14 — Route Segment Config · https://nextjs.org/docs/14/app/api-reference/file-conventions/route-segment-config | Options `dynamic`, `revalidate`, `runtime`, `maxDuration` lues statiquement ⇒ elles restent dans le `route.ts` | Doc officielle |
| S3 | Next.js — Upgrading to version 15 · https://nextjs.org/docs/app/guides/upgrading/version-15 | `params` devient une `Promise` dans `route.js` ; `GET` plus mis en cache par défaut ; `NextRequest.ip` / `.geo` supprimés | Doc officielle |
| S4 | RFC 9457 — Problem Details for HTTP APIs · https://www.rfc-editor.org/rfc/rfc9457.html | Une application peut garder le format d'erreur qu'elle définit déjà (§4) ; ne pas exposer de détail d'implémentation (pile, etc.) (§5) | IETF, Standards Track, juillet 2023 — relue le 2026-11-14 |
| S5 | RFC 9110 — HTTP Semantics · https://www.rfc-editor.org/rfc/rfc9110.html | Méthodes sûres et idempotentes (§9.2) ; `Retry-After` (§10.2.3) ; 403 : un serveur qui veut « cacher » l'existence d'une ressource interdite PEUT répondre 404 (§15.5.4) ; 409 = conflit avec l'état courant de la ressource (§15.5.10) ; 422 (§15.5.21) | IETF, Internet Standard — §15.5.4, §15.5.10, §15.5.21 relus le 2026-11-14 |
| S6 | RFC 6585 §4 — 429 Too Many Requests · https://www.rfc-editor.org/rfc/rfc6585.html | 429 « MAY include » `Retry-After` ; une réponse 429 « MUST NOT be stored by a cache » | IETF, avril 2012 — relue le 2026-11-14 |
| S7 | draft-ietf-httpapi-idempotency-key-header-08 · https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ | En-tête `Idempotency-Key` ; 400 si clé exigée absente, 422 si clé réutilisée avec un autre contenu, 409 si requête d'origine encore en cours | IETF httpapi WG — **Internet-Draft** (v08 du 2026-10-22, expire 2027-04-25), pas une RFC : traité comme une convention |
| S8 | Stripe API — Idempotent requests · https://docs.stripe.com/api/idempotent_requests | Clé générée par le client (UUID v4 conseillé), 255 caractères max, purge après ≥ 24 h, comparaison des paramètres, inutile sur `GET`/`DELETE` | Doc officielle Stripe — relue le 2026-11-14 |
| S9 | Google AIP-158 — Pagination · https://google.aip.dev/158 | Ajouter la pagination à une méthode existante est une rupture de compatibilité ; taille par défaut finie et maximum (une valeur au-dessus du maximum y est ramenée au maximum, pas refusée) ; jeton de page opaque | Guide d'API de Google — relu le 2026-11-14 |
| S10 | Google AIP-193 — Errors · https://google.aip.dev/193 | Identifiant d'erreur lisible par machine, pour que le client n'ait pas à analyser le message, qui peut changer ; **contrôler la permission avant l'existence**, et répondre `PERMISSION_DENIED` (403) quand la permission manque, que la ressource existe ou non | Guide d'API de Google — relu le 2026-11-14. Sa règle 403 diverge de notre choix 404 (Points à arbitrer n° 3) |
| S11 | Microsoft Azure REST API Guidelines · https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md | Corps d'erreur `{ error: { code, message, details } }` où `code` fait partie du contrat ; 400 sur validation ; identifiant de requête renvoyé et journalisé | `microsoft/api-guidelines` : 23 346 ★, push 2026-10-30, non archivé. Lecture du 2026-11-13, fin du fichier (≈ 8 700 caractères) non lue |
| S12 | Vercel — CDN Cache · https://vercel.com/docs/caching/cdn-cache | Critères de mise en cache d'une réponse de fonction (`GET`/`HEAD`, pas d'en-tête `Authorization`, statuts 200/404/410/301/302/307/308, pas de `set-cookie`, pas de `private`/`no-cache`/`no-store`) ; `s-maxage` retiré avant le navigateur ; une réponse `Vary: Cookie` n'est jamais mise en cache ; CDN inadapté aux réponses par utilisateur | Doc officielle, mise à jour 2026-09-14 — relue le 2026-11-14 |
| S12b | Vercel — Purging CDN Cache, « Cache keys » · https://vercel.com/docs/caching/cdn-cache/purge | Clé de cache = méthode, URL, hôte, URL du déploiement, schéma ; non configurable. Les cookies n'en font pas partie | Doc officielle, mise à jour 2026-09-03 — lue le 2026-11-14 |
| S13 | Vercel — Request headers · https://vercel.com/docs/headers/request-headers | `x-forwarded-for` = IP publique du client, réécrite par Vercel « to prevent IP spoofing » ; `x-real-ip` identique ; `x-vercel-id` = liste des régions traversées (la page ne dit pas qu'il est unique par requête) | Doc officielle, mise à jour 2025-12-13 — relue le 2026-11-14 |
| S14 | Upstash Ratelimit — Features · https://upstash.com/docs/redis/sdks/ratelimit-ts/features | Cache éphémère en mémoire, instance à créer hors du handler ; `timeout` (5 s par défaut) au-delà duquel la requête **passe** | Doc officielle Upstash — relue le 2026-11-14. Dépôt `upstash/ratelimit-js` : 2 052 ★, push 2026-11-12 (sous la barre des 3 000 ★, retenu comme dépôt officiel d'un outil installé) |
| S15 | Prisma ORM v6 — Error reference · https://www.prisma.io/docs/v6/orm/reference/error-reference | Classes d'erreurs du client ; sens de P2002, P2003, P2025, P2034, P2024, P1001, P1008, P1017 | Doc officielle Prisma (branche v6). Codes présents dans le moteur installé [L2] |
| S16 | Prisma ORM v6 — Pagination · https://www.prisma.io/docs/v6/orm/prisma-client/queries/pagination | Offset : saut de page possible mais ne passe pas à l'échelle ; curseur : passe à l'échelle, tri sur colonne unique, pas de saut | Doc officielle Prisma |
| S17 | Sentry — Next.js, capturing errors · https://docs.sentry.io/platforms/javascript/guides/nextjs/usage/ | Une erreur attrapée sans être relancée n'est vue par Sentry que si on appelle `captureException` | Doc officielle Sentry |
| S18 | Clerk — `auth()` (App Router) · https://clerk.com/docs/reference/nextjs/app-router/auth | `auth()` exige `clerkMiddleware()` ; utilisable dans les Route Handlers | Doc officielle Clerk |
| S19 | Vitest — `vi` API · https://vitest.dev/api/vi.html | `vi.mock` hoisté, variables de fabrique via `vi.hoisted`, clé `default` pour un export par défaut, `clearAllMocks` / `resetAllMocks` | Doc officielle Vitest |
| S20 | OWASP API Security Top 10 (2023) · https://api-security.owasp.org/editions/2023/en/0x11-t10 | API1 (autorisation au niveau objet), API3 (au niveau propriété : affectation de masse), API4 (consommation non bornée), API5 (au niveau fonction) | Fondation OWASP |
| S28 | Claude Code — Skills · https://code.claude.com/docs/en/skills.md | Format de ce skill (frontmatter, `when_to_use`, taille, fichiers d'appui, `${CLAUDE_SKILL_DIR}`) | Doc officielle Anthropic, transmise par le programme (SPEC.md du 2026-11-13) |
| S29 | RFC 5789 — PATCH Method for HTTP · https://www.rfc-editor.org/rfc/rfc5789.html | « PATCH is neither safe nor idempotent » (§2) | IETF, Standards Track, mars 2010 — lue le 2026-11-14 |

## Projets open source lus dans le code

| Id | Dépôt (★, dernier push au 2026-11-14) | Fichiers lus | Ce qu'on en retient |
| --- | --- | --- | --- |
| S21 | `calcom/cal.com` (50 022 ★, 2026-11-13) | `apps/web/app/api/defaultResponderForAppDir.ts`, `packages/lib/server/getServerErrorFromUnknown.ts` | Une fonction d'ordre supérieur par handler App Router ; conversion centrale des erreurs (Zod ⇒ 400 ; Prisma reconnu par classe **et**, en repli, par `code` commençant par « P » quand deux instances du client coexistent) ; les 4xx ne partent pas chez Sentry ; `params` typé `Promise` |
| S22 | `dubinc/dub` (25 165 ★, 2026-10-27) | `apps/web/lib/auth/workspace.ts`, `lib/auth/session.ts`, `lib/cron/with-cron.ts`, `lib/api/utils.ts`, `lib/auth/rate-limit-request.ts` | Une fabrique **par type d'accès** (`withWorkspace`, `withSession`, `withCron`) qui livre au handler un contexte résolu (tenant, session, `params` attendus, `searchParams`) ; erreur typée à code (`DubApiError`) ; `parseRequestBody` transforme un JSON invalide en 400. **À ne pas copier** : leur `Retry-After` reçoit `reset`, un horodatage en millisecondes, alors que RFC 9110 attend des secondes ou une date [S5] |
| S23 | `formbricks/formbricks` (13 241 ★, 2026-11-13) | `apps/web/app/lib/api/with-api-logging.ts`, `parse-and-validate-json-body.ts` | Wrapper qui enchaîne auth, rate limit, audit et rapport d'erreur ; helper « lire + valider le corps » qui distingue `invalid_json`, `invalid_body`, `payload_too_large` |
| S24 | `t3-oss/create-t3-app` (29 238 ★, 2025-12-13) | `cli/template/extras/src/server/api/trpc-app/with-auth.ts` (lu le 2026-11-13) | `publicProcedure` / `protectedProcedure` : le middleware d'auth **affine le type du contexte** — même idée que nos fabriques |
| S25 | `TheEdoRan/next-safe-action` (3 085 ★, 2026-10-12) + https://next-safe-action.dev/docs/getting-started | README, guide de démarrage | Client + middleware + schéma d'entrée, résultat en union discriminée ; **Server Actions uniquement**, ne couvre pas `route.ts` |
| S26 | `honojs/hono` (32 944 ★, 2026-11-11) · https://hono.dev/docs/getting-started/nextjs | Guide Next.js | Intégration par route attrape-tout `app/api/[[...route]]/route.ts` + `handle(app)` |
| S27 | `colinhacks/zod` (44 325 ★, 2026-11-13) | Version installée 3.25.76 | Comportements vérifiés localement (L4) plutôt que sur la doc |

Dépôts officiels des outils installés, relevés pour mémoire : `vercel/next.js` 143 506 ★,
`prisma/prisma` 47 672 ★, `trpc/trpc` 40 805 ★, `vitest-dev/vitest` 17 375 ★,
`getsentry/sentry-javascript` 8 774 ★, `clerk/javascript` 1 782 ★ (tous poussés le 2026-11-13 ou 14).

## Sources écartées

| Source | Raison |
| --- | --- |
| `ts-rest/ts-rest` (3 341 ★) | `archived: true` |
| `Melvynx/next-zod-route` (72 ★, push 2025-09-13) | Sous la barre d'adoption |
| `Xunnamius/next-test-api-route-handler` | Sous la barre d'adoption (relevé du 2026-11-13) ; inutile : un handler App Router s'appelle directement avec un `NextRequest` |
| Reddit (r/nextjs, r/reactjs…) | Aucune affirmation de ce skill n'en vient (domaine inaccessible à nos outils le 2026-11-13) |
| YouTube / conférences | Aucune transcription consultée : aucune affirmation n'en vient |

## Preuves locales

| Id | Preuve | Reproduire |
| --- | --- | --- |
| L1 | Inventaire 2026-11-14 à 08 h 35 (l'arbre du chantier bouge encore) : 188 `route.ts`, 249 méthodes (117 GET, 69 POST, 41 PATCH, 22 DELETE), 0 sur une fabrique ; 198 fichiers à `HEAD 32c581f` (13 supprimés et 3 ajoutés dans l'arbre de travail) ; 29 écarts de niveau erreur ; 181 fichiers `force-dynamic`, 6 sans config de segment, 1 en `revalidate` | `node .claude/skills/api-route-conventions/scripts/audit-routes.mjs` ; `git ls-tree -r --name-only HEAD src/app/api \| grep -c route.ts` ; `git status --short src/app/api` |
| L2 | `handleApiError` reconnaît Prisma par le **texte** du message, journalise par `console.error`, traite toute autre erreur (dont `SyntaxError`) en 500 + Sentry ; sa branche « connexion à la base » répond 500 sans appeler Sentry. Dans le moteur installé, « Record to update not found » et « Record to delete does not exist » sont absents, `P2025` dit « An operation failed because it depends on one or more records that were required but not found » suivi d'une cause « No record was found for … » ; « Unique constraint failed on the » est présent. `PrismaClientInitializationError` porte `errorCode`, pas `code` | `src/lib/api/errors.ts:133-184` ; `grep -rl "Record to update not found" node_modules/@prisma/client/runtime node_modules/.prisma/client` (0) ; `strings node_modules/.prisma/client/*.node \| grep "required but not found"` ; `node_modules/@prisma/client/runtime/library.d.ts` |
| L3 | Reproduit le 2026-11-14 sur les handlers de l'arbre de travail (Vitest 4.1.5, Prisma et auth mockés) : `POST /api/cart` et `POST /api/orders` avec `{oups` ⇒ **500** ; `GET /api/admin/orders?page=abc` ⇒ `findMany({ skip: NaN })` | test jetable hors dépôt ; patron dans [tests-handlers.md](tests-handlers.md) § 5 |
| L4 | Zod 3.25.76 sous Node : `z.coerce.boolean().parse("false") === true` ; `z.coerce.number()` donne `0` pour `""` et échoue sur `"abc"` ; `.default(20)` s'applique à `undefined` ; `z.object` retire les clés inconnues, `.strict()` les refuse ; `z.string().datetime()` accepte `…Z`, refuse `…+01:00` (accepté avec `{ offset: true }`) et une date seule ; `z.unknown()` accepte `undefined` ; `z.record(z.string(), z.unknown())` refuse `null` et les tableaux ; `Math.max(1, parseInt("abc"))` vaut `NaN` ; `Request.json()` lève `SyntaxError` sur corps vide | `node -e` avec `require("zod")` |
| L5 | Le matcher Clerk exclut `/api/cron`, `/api/webhooks/`, `/api/payments/webhook`, `/api/health`, `/api/test-mode/`, `/api/geo`, `/api/shops/nearby` ; le test échoue si un handler exclu a `server-auth`, `boucher-auth` ou `admin-auth` dans sa fermeture d'imports (imports dynamiques compris). `route-open` + `route-core` n'y entrent pas (imports : `errors`, `cron-auth`, `rate-limit` → `redis`, `logger` → `test-mode-env`) | `src/middleware.ts:245-277`, `src/lib/__tests__/middleware-matcher.test.ts` |
| L6 | Le garde de types généré par Next 14.2.35 n'autorise dans un `route.ts` que les méthodes HTTP et `config`, `generateStaticParams`, `revalidate`, `dynamic`, `dynamicParams`, `fetchCache`, `preferredRegion`, `runtime`, `maxDuration` ; premier argument `Request \| NextRequest`, second `any`, retour `Response` | `node_modules/next/dist/build/webpack/plugins/next-types-plugin/index.js:39-90` |
| L7 | Le 2026-11-14 (auteur, puis vérificateur avec son propre `tsconfig`) : les gabarits de `templates/`, l'anatomie de `SKILL.md`, les extraits de contrat-http et de wrapper.md § 4 et deux formes de `POST /api/orders` (`clientRoute` ou `userRoute` + `resolveOrderCustomer`, avec `body: z.unknown()` + `createOrder`) compilent (`tsc` 5.9.3, `tsconfig` du projet étendu, code retour 0) ; les 22 tests des gabarits passent (16 + 6, Vitest 4.1.5) contre Next 14.2.35, Zod 3.25.76, Prisma 6.19.2, `@upstash/ratelimit` 2.0.8, `@sentry/nextjs` 10.49.0 ; le garde de types de Next [L6], recopié à la main pour le handler d'exemple, compile ; `redirect()` de `next/navigation` dans un handler sur fabrique ⇒ 500, `NextResponse.redirect` ⇒ 307 ; Vitest 4.1.5 : `clearAllMocks` garde implémentations et valeurs `Once` en file, `resetAllMocks` les retire | [migration.md](migration.md) § 1 ; `tsconfig` qui fait pointer `@/lib/api/route-*` vers `templates/` |
| L8 | `checkRateLimit` laisse passer si Redis est absent ou en erreur, ne renvoie que `success` et `remaining`. `RatelimitResponse` contient aussi `limit`, `reset` (horodatage ms), `reason` ; `timeout` vaut 5000 ms par défaut | `src/lib/rate-limit.ts`, `node_modules/@upstash/ratelimit/dist/index.d.ts` |
| L9 | Avant le chantier (`HEAD`) : `discountCents` lu dans le corps de `createOrder`. Arbre de travail : `createOrderSchema` `.strict()` sans montant, `findByIdempotencyKey` borné au client (`CONFLICT` sinon), `P2002` interprété via `uniqueViolationFields(...)?.includes("idempotency_key")` | `git show HEAD:src/lib/services/orders/create.ts`, `src/lib/services/orders/create.ts`, `src/lib/validators/order.ts` |
| L10 | À `HEAD`, `GET /api/products/[id]` renvoie sur la même URL une variante publique `apiCached(…, 60)` et des variantes gérant / pro non cachées. Dans l'arbre de travail (08 h 19), ses trois branches passent par `privateNoStore(...)`, ajouté à `src/lib/api/errors.ts` ; projections publiques dans `src/lib/public-projections.ts` | `git show HEAD:"src/app/api/products/[id]/route.ts"` ; `src/app/api/products/[id]/route.ts` ; `grep -rn privateNoStore src` |
| L11 | Historique des corrections de masse sur les handlers | `git log -1` sur `b4cf98c`, `3e0e236`, `c514358`, `d0a1598`, `ff0752e`, `6f75818`, `5d74e38`, `7813dc7`, `f2cac19`, `0747029`, `0d6fd80`, `e3b1629` |
| L12 | Consommation de l'enveloppe côté client : 54 fichiers hors `src/app/api` lisent `.success` ; trois lisent un code d'erreur — `components/checkout/OrderCountdown.tsx` et `app/(client)/panier/page.tsx` (écrans), `lib/hooks/use-order-quote.ts` (hook) — pour `PRICE_CHANGED` et `PRODUCTS_MISSING` | `grep -rlE "\.success\b" src` hors `src/app/api` et `__tests__` ; `grep -rnE "code\s*(===\|!==)\s*\"[A-Z_]+\"" src` hors `src/app/api` |
| L13 | `requireAdmin()` renvoie `userId` = identifiant **Clerk** ; `getAuthenticatedBoucher()` renvoie `userId` = identifiant **Prisma** | `src/lib/admin-auth.ts:18-65`, `src/lib/boucher-auth.ts:20-99` |
| L14 | Le `tsc` du projet n'inclut aucun fichier de `.claude/`, et le projet Vitest `unit` exclut `.claude` : les gabarits du skill ne touchent ni le build ni la CI | `npx tsc --listFilesOnly --incremental false` ; `vitest.config.ts` |
| L15 | `@vercel/functions` n'est pas installé (`node_modules/@vercel` : `analytics`, `blob`, `speed-insights`) | `ls node_modules/@vercel` |
| L16 | Zod 3.25.76 expose aussi `zod/v4` ; le dépôt importe `from "zod"` (API v3) | `node_modules/zod/package.json` (`exports`) |
| L17 | 8 `await sendNotification(...)` dans des handlers ; 75 fichiers avec `findMany`, dont 31 sans aucun `take:` ; 11 fichiers de `src/app/api` appellent `writeAuditLog` | `grep` sur `src/app/api` |
| L18 | `src/lib/api/client.ts` puis `src/lib/api/index.ts` (le baril, qui ré-exportait `./client`) sont supprimés dans l'arbre de travail ; aucun fichier n'importait le baril `@/lib/api`. `npx tsc --noEmit` : une erreur à 07 h 55 (`index.ts`, TS2307), zéro à 08 h 35, plusieurs centaines entre-temps pendant une écriture du chantier | `git status --short src/lib/api` ; `grep -rln 'from "@/lib/api"' src` ; `npx tsc --noEmit --incremental false` |
| L19 | Next 14.2.35 : hors `force-dynamic` / `force-static`, la requête d'un route handler est enveloppée dans un proxy ; lire `headers`, `cookies`, `url`, `body`, `json`, `text`… appelle `trackDynamicDataAccessed`, qui met `revalidate` à 0 et, pendant la génération statique, lève `DynamicServerError`. `route-core.ts` lit `req.headers` à sa première ligne, hors du `try` (test « laisse remonter l'erreur… », qui échoue si on déplace la lecture dans le `try`). `/api/calendar-events` est la seule route d'API du manifeste de prérendu (`initialRevalidateSeconds: 60`). Établi par lecture du code de Next et par ce test ; aucun build n'a été lancé avec une fabrique | `node_modules/next/dist/server/future/route-modules/app-route/module.js:212-237, 424-470` ; `node_modules/next/dist/server/app-render/dynamic-rendering.js:110-131` ; clés `/api/…` de `.next/prerender-manifest.json` après `npm run build` (relevé sur un build du 2026-11-13 ; même constat dans `nextjs-app-router`, sources L9) ; `templates/api-route-core.test.ts` |

## Non vérifié, ou établi sans mesure

N'appuient aucune règle :

- Limite de taille du corps d'une requête sur les fonctions Vercel : non relue. La règle « borner chaque
  chaîne et chaque tableau » ne s'appuie que sur S20 (API4).
- Unicité de `x-vercel-id` par requête : la page S13 ne la garantit pas. Il sert d'identifiant de
  corrélation, jamais de clé.
- Isolation des tags Sentry par requête : non vérifiée ; le moteur utilise `Sentry.withScope`.
- Une fabrique `withAdmin` chez Dub, citée dans un brouillon antérieur : introuvable dans
  `apps/web/lib/auth/` le 2026-11-14 (`admin.ts` n'exporte que `getDubAdminRole`), retirée.

Appuient une règle de prudence, qui reste juste si la mesure les dément :

- Le CDN face à une requête porteuse de cookies : la documentation dit qu'ils ne sont ni dans la clé
  de cache [S12b] ni parmi les critères d'exclusion [S12], mais `x-vercel-cache` n'a pas été mesuré
  (recette sans session ni preview : etat-du-code E8).
- Le passage d'un handler prérendu en dynamique sous une fabrique [L19] : lu dans le code de Next
  14.2.35 et verrouillé par un test du gabarit, mais non constaté dans la table d'un `next build`.
