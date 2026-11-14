# Migration vers les fabriques — recette route par route

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md). Principe : **une PR de migration ne change
pas le comportement métier**. On remplace le squelette, on garde la logique ; les corrections (requête
bornée au tenant, 409 au lieu de 400, pagination) font l'objet de commits séparés, chacun avec son test.

## 1. Étape 0 — poser le socle (une seule fois)

```bash
SK=.claude/skills/api-route-conventions/templates
cp $SK/route-core.ts  src/lib/api/route-core.ts
cp $SK/route-open.ts  src/lib/api/route-open.ts
cp $SK/route-auth.ts  src/lib/api/route-auth.ts
cp $SK/api-route-core.test.ts src/lib/__tests__/api-route-core.test.ts
npx tsc --noEmit && npx vitest run --project unit src/lib/__tests__/api-route-core.test.ts src/lib/__tests__/middleware-matcher.test.ts
```

Les gabarits s'importent déjà entre eux par leurs chemins définitifs (`@/lib/api/route-core`) : aucune
retouche après copie. Ils ont été compilés (`tsc` 5.9.3) et testés (16 + 6 tests) le 2026-11-14 depuis
le dossier du skill, avec un `tsconfig` qui fait pointer ces trois alias vers `templates/` [L7].
Toujours nommer le projet Vitest (`--project unit`) : sans lui, `vitest run` lance aussi le projet
`integration`, qui exige une base. Le `tsc` du projet ignore `.claude/` [L14] : laisser les gabarits
en place ne change rien au build.

Tant que le chantier prix écrit dans l'arbre, `npx tsc --noEmit` peut sortir des erreurs qui ne sont
pas les vôtres (etat-du-code E11) : relancer, lire `git status`, ne rien « corriger » hors du lot.

Dans la même PR, les deux correctifs de [wrapper.md](wrapper.md) § 4 (a : `reset` dans
`checkRateLimit`, en y important `logger` ; b : Prisma reconnu par code dans `handleApiError`) avec
leurs tests. Ne **pas** recréer de baril `src/lib/api/index.ts` (supprimé par le chantier prix [L18])
pour y ranger les fabriques : un handler de cron qui importerait l'index tirerait Clerk dans sa
fermeture d'imports.

## 2. Choisir la fabrique

```
Le handler vérifie-t-il un secret de cron ?                     → cronRoute        (route-open)
Ne lit-il aucune session, réponse identique pour tous ?         → openRoute        (route-open)
Lit-il la session « si elle existe » ?                          → optionalUserRoute
Appelle-t-il getAuthenticatedBoucher() ?                        → boucherRoute
Appelle-t-il requireAdmin() ?                                   → adminRoute
Appelle-t-il getServerUserId() puis cherche l'utilisateur Prisma (ou getOrCreateUser) ? → clientRoute
Appelle-t-il getServerUserId() sans lire la base ?              → userRoute
```

Cas à part, à migrer en dernier et à la main :

- `getBoucherOwnerUserId()` (9 fichiers à 08 h 35) et les contrôles de rôle faits à la main
  (`dbUser.role !== "BOUCHER"`) : vérifier d'abord que `boucherRoute` donne le même résultat en test
  mode (rôle BOUCHER **et** ADMIN), puis remplacer ; sinon garder `userRoute` et l'appel existant.
- Session invitée (`getGuestUser()`, cookie `klikgo-guest-token`) : `optionalUserRoute`, résolution
  de l'invité dans le handler. Aucun `route.ts` ne l'appelle aujourd'hui (seule la page `suivi/[id]`
  le fait ; `checkout/guest` pose le cookie).
- `calendar-events` : **ne pas migrer**. Seul handler prérendu (`revalidate = 60`) ; une fabrique le
  rendrait dynamique (etat-du-code § 4).
- `cron/route.ts` : contrôle `x-cron-secret` écrit à la main ; sur `cronRoute`, il accepte en plus
  `Authorization: Bearer` (à dire dans la PR).
- Un fichier dont les méthodes n'ont pas le même accès (`GET` public, `PATCH` boucher) : une fabrique
  par méthode ; les deux imports cohabitent tant que le chemin est dans le matcher.
- Webhooks, flux SSE, exports : voir etat-du-code § 4. On peut les passer sur `openRoute` /
  `boucherRoute` **sans** `body` pour gagner le `try/catch`, le tag Sentry et `x-request-id`, mais ce
  n'est pas prioritaire.

## 3. Les sept gestes

Exemple réel : `src/app/api/products/[id]/stock/route.ts` (57 lignes). Résultat complet et son test :
`templates/examples/product-stock.route.ts` et `product-stock.route.test.ts`.

| # | Avant | Après |
| --- | --- | --- |
| 1 | `export async function PATCH(req, { params }: { params: { id: string } }) {` | `export const PATCH = boucherRoute({ name: "products/stock", … }, async ({ auth, params, body }) => {` |
| 2 | `try { … } catch (error) { return handleApiError(error); }` | supprimé (la fabrique le fait, avec `name` comme contexte) |
| 3 | `const authResult = await getAuthenticatedBoucher(); if (authResult.error) return authResult.error; const { shopId } = authResult;` | supprimé ; `auth.shopId` |
| 4 | `const rl = await checkRateLimit(rateLimits.api, …); if (!rl.success) return apiError("RATE_LIMITED", …)` | `rateLimit: "api"` dans la config |
| 5 | `const { id } = params;` | `params: z.object({ id: z.string().min(1).max(64) })` dans la config ; `params.id` |
| 6 | `const data = schema.parse(await req.json());` | `body: schema` dans la config ; `body` |
| 7 | `Object.fromEntries(req.nextUrl.searchParams)` + `schema.parse`, ou `parseInt(sp.get("page"))` | `query: schema` dans la config ; `query` |

Ce qui ne bouge pas : `export const dynamic = "force-dynamic"` (et `runtime`, `maxDuration`) en tête
du fichier [S2] ; les `return apiError(...)` métier ; les appels aux services ; les imports de
`apiSuccess` / `apiError`.

Imports à retirer s'ils ne servent plus : `NextRequest`, `handleApiError`, `checkRateLimit`,
`rateLimits`, le helper d'auth.

## 4. Changements de comportement à connaître (et à dire dans la PR)

| Changement | Effet visible | Risque |
| --- | --- | --- |
| La validation passe **avant** les lectures en base du handler | Un corps invalide sur la ressource d'un autre répond 400 au lieu de 403/404 | Aucun pour les écrans (ils lisent `message`) ; adapter un test qui attendrait 403 avec un corps invalide |
| JSON mal formé | 400 `VALIDATION_ERROR` au lieu de 500 | Correctif (E1) |
| Corps vide sur une route à `body` | 400 avec `details._root` au lieu de 500 | Si l'appelant n'envoie légitimement rien : `schema.optional()` ou `.default({})` |
| Rate limit ajouté ou clé renommée (`order-accept:<shop>` → `orders/accept:<shop>`) | Les compteurs repartent de zéro au déploiement | Négligeable |
| Rate limit par IP sur une route ouverte qui limitait par utilisateur (`search`) | Un bureau entier partage un compteur | Choisir `optionalUserRoute` si la limite par compte compte plus que le cache |
| `Cache-Control: private, no-store` sur toute route personnalisée | Fin d'un cache CDN posé par erreur ; les appels à `privateNoStore(...)` du handler deviennent inutiles et se retirent | Vérifier qu'aucun écran ne comptait sur ce cache (E8, déjà corrigé) |
| Le handler devient dynamique (la fabrique lit `req.headers`) | Aucun pour les 181 fichiers déjà `force-dynamic` ; les 6 sans config de segment la reçoivent en migrant ; `calendar-events` perdrait son prérendu | Ne pas migrer `calendar-events` ; audit `static-with-factory` |
| Query validée par schéma (`paginationSchema` : `perPage` ≤ 50) | `?limit=100` n'est plus lu, `?perPage=100` répond 400 au lieu d'être ramené au maximum | Changer l'écran appelant dans le même commit (correction E2/E5, hors lot mécanique) |
| `x-request-id` et `Retry-After` ajoutés | — | Aucun |
| `ctx.auth.userId` de `clientRoute` est l'identifiant **Prisma** | Les comparaisons avec `Order.userId` deviennent directes | Supprimer la résolution manuelle `clerkId → id`, ne pas la laisser en double |

## 5. Ordre de migration conseillé

Par lots homogènes de 10 à 20 fichiers, un lot par PR, du moins risqué au plus sensible :

1. **Crons** (`src/app/api/cron/**`, 17 fichiers : 16 sur `verifyCronAuth`, plus `cron/route.ts`)
   → `cronRoute`. Sans corps ni écran : valide la mécanique et le verrou du matcher.
2. **Back-office admin et webmaster** (≈ 59 fichiers `requireAdmin`) → `adminRoute`. Peu de trafic,
   beaucoup de listes : traiter E2 et E5 au passage, dans un commit séparé.
3. **Boucher hors commandes** (catalogue, images, réglages, clients) → `boucherRoute`.
4. **Client** (panier, favoris, fidélité, avis, support) → `clientRoute` / `userRoute`.
5. **Publiques** (`shops`, `products`, `search`, `suggestions`) → `openRoute` ou
   `optionalUserRoute` ; décider du cache avec `vercel-cost-performance`. `calendar-events` reste
   hors fabrique (§ 2).
6. **Commandes et paiement** (`orders/**`, `boucher/orders/**`, `checkout/**`, `payments/**`) en
   dernier, **après** que le chantier prix (non commité au 2026-11-14) a été fusionné, et **avec**
   `order-lifecycle-realtime` et `stripe-payment`. Ces routes sont déjà minces (services, commandes,
   `transitionResponse`) : la migration y est mécanique. `POST /api/orders` passe sur `userRoute` +
   `body: z.unknown()` : `createOrder` valide lui-même, et `resolveOrderCustomer(auth.clerkId)`
   (`services/orders/customer.ts`) rend déjà le client Prisma — `clientRoute` ferait la lecture deux
   fois (variante compilée [L7]) ; `checkout/guest` (sur `openRoute` ; ses limites de débit suivent
   `security-multitenant`, `abus-webhooks-crons.md` § 4) à `body: z.record(z.string(), z.unknown())`, qui remplace son
   test « objet non nul » et garde la séparation des champs invités.

À chaque nouvelle route créée entre-temps : fabrique obligatoire, quel que soit l'avancement.

## 6. Vérifier un lot

```bash
node .claude/skills/api-route-conventions/scripts/audit-routes.mjs --strict <fichiers du lot>
npx tsc --noEmit
npm run lint
npm run test                      # projet unit : tests/api, src/lib/__tests__…
npm run test:integration          # si le lot touche une route couverte par tests/integration (base locale requise)
npm run build && node scripts/check-prerender.mjs     # avec une base joignable (voir nextjs-app-router)
```

- `audit-routes.mjs --strict` doit sortir 0 sur les fichiers du lot, et la ligne « Migration » de la
  synthèse doit avoir augmenté du nombre de méthodes migrées.
- Si le lot touche un chemin exclu du matcher (cron, webhook, health, geo, `shops/nearby`),
  `middleware-matcher.test.ts` doit rester vert : c'est lui qui détecte un import de
  `@/lib/api/route-auth` au mauvais endroit.
- Chaque handler dont on change plus que le squelette reçoit ou met à jour son test
  ([tests-handlers.md](tests-handlers.md)). Pour une migration purement mécanique d'un handler déjà
  testé, le test existant doit passer **sans modification** autre que les mocks listés au § 7.
- Appel réel, en local : serveur + base locale, test mode activé par `POST /api/test-mode/activate`
  puis rôle changé par `PATCH` (`CLAUDE.md` § Test Mode) — un appel par famille migrée et par rôle,
  200 attendu, puis 401 sans cookie. Il n'y a pas de preview Vercel pour les branches `claude/**`
  (l'environnement Preview n'a pas de base : `CLAUDE.md` § CI/CD) ; ne jamais faire cet essai sur la
  production.

## 7. Adapter les tests existants

Les tests unitaires de `tests/api/**` (`checkout/guest`, `loyalty`, `support/tickets` au 2026-11-14)
importent le module de route et appellent la méthode : ils continuent de fonctionner. Les tests
d'intégration (`tests/integration/api/public-exposure.test.ts`) aussi : ils ne mockent que les helpers
d'auth. Trois ajustements possibles :

- Un handler passé sur une fabrique de `route-auth.ts` charge aussi les autres helpers d'auth. Ajouter les
  mocks qui manquent pour ne charger ni Clerk ni `next/headers` :

  ```ts
  vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: vi.fn() }));
  vi.mock("@/lib/boucher-auth", () => ({ getAuthenticatedBoucher: vi.fn() }));
  vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));
  vi.mock("@/lib/get-or-create-user", () => ({ getOrCreateUser: vi.fn() }));
  ```

- Le mock de `@/lib/rate-limit` doit exposer `rateLimits` (un objet vide suffit) et
  `checkRateLimit` résolu à `{ success: true }` dans `beforeEach`.
- `clientRoute` lit `prisma.user.findUnique({ where: { clerkId }, select: { id, role } })` : le mock
  Prisma doit le prévoir (`{ id: "user-db-1", role: "CLIENT" }`).

## 8. Ce qu'on ne fait pas pendant la migration

- Renommer une URL, une méthode, un paramètre de query, un champ de réponse ou un code d'erreur lu
  par un écran [L12].
- Passer une route en `openRoute` + `apiCached` « pour la performance » sans avoir vérifié qu'elle ne
  lit aucune session et que sa réponse est la même pour tous.
- Introduire `zod/v4`, une Server Action, tRPC ou une bibliothèque de wrapper : décisions
  d'architecture, hors du périmètre d'un lot.
- Corriger une faille « en passant » (comme E9, remise lue dans le corps, corrigée à part par le
  chantier prix) : un correctif de sécurité est un commit à part, avec son test.
