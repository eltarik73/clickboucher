# État des lieux des tests — relevé du 2026-11-14 (dernière mesure : 08 h 27)

Arbre décrit : HEAD `32c581f` **plus** l'arbre de travail non commité du chantier 0 (intégrité des commandes : `src/lib/pricing/*`, `src/lib/services/orders/*`, `tests/integration/**`). Les identifiants `[L…]` renvoient aux vérifications locales de [sources.md](sources.md). Les identifiants `T…` et `D…` sont cités par d'autres skills (`order-lifecycle-realtime`, `design-klikgo`, `accessibility-wcag`) : ne pas les renuméroter, marquer « levé » au lieu de supprimer.

Les chiffres bougent avec le chantier, d'heure en heure (entre 08 h 00 et 08 h 27 : + 5 tests unitaires, + 1 fichier et + 17 tests d'intégration) : relancer avant de citer. Relevé rejoué le même jour par un vérificateur indépendant (`[L25]`–`[L30]`) : inventaire, mesures, T2, T4, T5, T11 et D1–D4 confirmés ; T19 et la ligne `/commandes` du §5 corrigés ; CLAUDE.md relu dans sa version de l'arbre de travail (sa section « Tests » décrit déjà les deux projets Vitest).

```bash
node .claude/skills/testing-strategy/scripts/audit-tests.mjs
```

## 1. Inventaire `[L17][L18][L19]`

| Famille | Emplacement | Mesure du 2026-11-14 | Ce que ça prouve réellement |
|---|---|---|---|
| Fonctions pures, hooks, handlers simulés | projet Vitest `unit` : `src/**/__tests__`, `tests/{lib,api,services,security}` | 42 fichiers, 909 tests, verts, ≈ 3,5 s (dont 7 à 8 s cumulées d'environnement `jsdom`) | Le calcul : prix (`pricing-*`), panier (`cart-line`), machine à états, heure de Paris, horaires, RBAC, jeton de session de test, matcher du middleware, numérotation. Solide. |
| Intégration sur PostgreSQL réel | projet `integration` : `tests/integration/**` | 18 fichiers, 233 tests, verts, 40 à 45 s, base Docker locale | Création de commande depuis le devis serveur, idempotence, courses accepter / annuler / expirer, stock limité, remises, numérotation, tableau cuisine, notifications, exposition publique. Le cœur métier est couvert. |
| Bout en bout | `tests/e2e/smoke.spec.ts` | 1 fichier, 10 tests | Dix pages publiques répondent. Lancé par aucun job ; `baseURL` = production par défaut. |
| Composant | `tests/components/FormWizard.test.tsx` | exclu de la suite | Rien (T4). |

## 2. Ce qui tient (à imiter)

- **Infrastructure d'intégration sûre par construction** (`tests/integration/setup/*`, `helpers/db.ts`) : refus de tout hôte non local, schéma dédié `itest`, verrou consultatif PostgreSQL entre lancements concurrents, `prisma db push` du CLI installé (pas `npx`), `TRUNCATE … RESTART IDENTITY CASCADE` qui refuse tout autre schéma. Elle se teste elle-même (`infra.test.ts`, `tests/lib/integration-database-url.test.ts`).
- **Fabriques minimales** (`helpers/factories.ts`) : valeurs uniques, seules les colonnes obligatoires, `overrides` prioritaires, prix d'article dérivé du produit.
- **Courses rejouées** (`orders/transition-races.test.ts`) : `Promise.all` de vrais handlers, cinq tours par `it.each`, un seul gagnant, un seul `OrderEvent`, stock et usage d'offre cohérents.
- **Montants jamais recalculés par le test** : `create-order-fixtures.ts` prend `expectedTotalCents` dans le devis du serveur (`quoteOrder`).
- **Tests de structure** qui verrouillent une règle de code : `middleware-matcher.test.ts` (CLAUDE.md, coût CPU), `tests/lib/order-writers-guard.test.ts` (un seul écrivain de `Order.status`).
- **Temps en instants UTC explicites** (`paris-time.test.ts`) et minuteurs simulés (`use-order-polling.test.ts`).
- **CI** : lint, typage, tests (`unit` puis `integration` sur le service PostgreSQL 16), build avec garde de pré-rendu ; annulation des lancements périmés.

## 3. Écarts

| # | Constat | Preuve | Conséquence | Correction |
|---|---|---|---|---|
| T1 | *Partiellement levé.* Les services et handlers de commande sont testés sur base réelle, mais **avec `@/lib/boucher-auth` et `@/lib/auth/server-auth` simulés** (6 fichiers à 08 h 27 : `api/public-exposure`, `orders/{kitchen-board,commands-shop,commands-customer,order-customer,transition-races}`). La résolution « session Clerk → utilisateur → boutique » (clause `OR` sur `ownerId`, caches) n'est jamais exercée. 4 fichiers du projet `unit` simulent encore Prisma (`tests/api/{checkout,loyalty,support}`, `tests/services/orders/list`), ce que CLAUDE.md interdit désormais. | `[L19]`, `grep vi.mock tests/integration`, audit `[L18]` | Une régression d'isolation dans `boucher-auth.ts` reste verte ; les 4 fichiers ne prouvent aucune écriture. | Simuler **Clerk seul** : [integration-postgres.md](integration-postgres.md) §3, vérifié `[L20][L26]`. Migrer les 4 fichiers en intégration (A8). |
| T2 | `tests/security/multitenant.test.ts` (22 tests) teste des fonctions recopiées ; sa copie de `isAdmin` vaut `role === "ADMIN"`, la vraie (`src/lib/roles.ts`) accepte `admin` et `webmaster` sans casse. `tests/lib/cart-utils.test.ts` a été supprimé par le chantier. | `[L18]` | Fausse assurance de sécurité. | Supprimer le fichier en le remplaçant par les tests d'isolation de [integration-postgres.md](integration-postgres.md) §3 et la table de `roles` ([vitest-unitaire-et-composants.md](vitest-unitaire-et-composants.md) §3). |
| T3 | Playwright n'est lancé par aucun job ; `baseURL` vaut `https://klikandgo.app` par défaut ; la spec vise `/boutique/boucherie-tarik`, absent du seed. | `playwright.config.ts`, `ci.yml`, `prisma/seed.ts` | Un parcours qui écrit, lancé sans variable, écrirait en production ; chaque page vue en production coûte du CPU Vercel. | `templates/e2e/playwright.config.ts`, [playwright-e2e.md](playwright-e2e.md), [ci.md](ci.md). |
| T4 | Composants exclus (« broken by JSX/TSX loader ») : `tsconfig.json` impose `"jsx": "preserve"` (Next), Vite 8 ne transforme pas le JSX. | `[L21]` : sans option, « make sure to not set jsx to preserve » ; avec `oxc: { jsx: { runtime: "automatic" } }`, 6/6 verts | Aucun composant testé. | Une ligne dans `vitest.config.ts`, aucune installation (A6). |
| T5 | Projet `unit` en `jsdom` par défaut alors que 3 fichiers seulement utilisent le DOM `[L4]`. | 6,4 s cumulées d'environnement pour 2,9 s de suite `[L17]` | Lenteur ; du code serveur peut lire `window` sans que le test le voie. | Projets `unit` (`node`) et `dom` (A6). |
| T6 | `npm run test:ui` existe, `@vitest/ui` n'est pas installé. | `[L9]` | Commande documentée inutilisable. | A1. |
| T7 | Deux emplacements de tests purs, tous deux admis par CLAUDE.md : `src/lib/__tests__/` et `tests/lib/`. | `[L1]`, CLAUDE.md « Tests » | Hésitation, doublons (`shop-hours` est testé aux deux endroits). | Préférer `src/lib/__tests__/` pour un module de `src/lib` ; chercher un test existant du module avant d'en créer un ; n'en garder qu'un seul emplacement : A8. |
| T8 | `prisma/seed.ts` : 26 `deleteMany` sans contrôle de la base ; `Math.random()` (prix ± 5 %, 10 % de ruptures, promotions, téléphone) ; dates relatives à `Date.now()` ; lancé par `npx tsx` alors que `tsx` n'est pas une dépendance. | `[L1][L9]` | Avec la mauvaise `DATABASE_URL`, il vide la base ; aucun test ne peut affirmer un prix ou un stock du seed. | Les parcours créent leurs propres produits (`makeProduct`). Garde-fou, graine fixe, `tsx` en dépendance : A4. |
| T9 | Ce que donne le mode test : §5. | `[L1][L12][L22]` | Navigateur « client » = `TEST_USERS.CLIENT` au panier, mais `/commandes` ne le voit pas connecté ; tous les parcours boucher partagent une boutique. | Scénarios écrits en conséquence ([scenarios-e2e.md](scenarios-e2e.md)) ; A2, A3. |
| T10 | Caches de 60 s par instance (`boucher-auth.ts`, `admin-auth.ts`, `middleware.ts`) ; avec Upstash : statut boutique et limites de débit (commandes, activation du mode test). Le seed plafonne « El Fathe » à 25 commandes par heure. | `[L1]`, `shop-capacity.ts` | `CAPACITY_EXCEEDED` ou 429 sans rapport avec le sujet ; un `clerkId` réutilisé lit l'ancienne boutique. | Identifiants uniques ; variables Upstash vides en test ; `prepareKitchenShop()` relève les plafonds. |
| T11 | `prisma migrate deploy` échoue toujours sur une base vide (`20260422000000_add_missing_indexes` : `column "expires_at" does not exist`). | `[L23]` | Toute base neuve (CI, test) naît de `db push` : la CI ne prouve pas que les migrations produisent le schéma. | Hors de ce skill : `prisma-expert` (A5). |
| T12 | Non adressables : la carte cuisine (`<div>` sans rôle ni nom), les champs invité (`placeholder` seul), l'étape courante du suivi (couleur et émoji, pas d'`aria-current`). | `KitchenOrderCard.tsx`, `panier/page.tsx`, `SuiviClient.tsx` | Sélecteurs fragiles, et défaut d'accessibilité. | `role="article"` + `aria-label` sur la carte, `<label>` sur les champs, frise en `<ol>` / `<li>` avec `aria-current="step"` (forme attendue par le gabarit E5 ; à valider avec `accessibility-wcag`), dans le commit du premier parcours qui en a besoin. |
| T13 | Confirmation de commande : compte à rebours annulable de 5 s, puis 2 s d'écran de succès avant la redirection. | `OrderCountdown.tsx` (`duration = 5`, `SUCCESS_DELAY_MS = 2000`) | Une attente au délai d'assertion par défaut (5 s) échoue. | `waitForURL(…, { timeout: 15_000 })` sur l'effet. |
| T14 | `next lint` ne couvre pas `tests/` ; `.eslintrc.json` ignore `tests/e2e/` ; `no-floating-promises` n'est activée nulle part. `tsc --noEmit` couvre `tests/**`. | `[L16]` | Un `await` oublié dans une spec donne un test vert qui ne vérifie rien `[PW1]`. | Lint typé de `tests/**` (A10). |
| T15 | Aucun seuil de couverture ; couverture non calculée en CI. | `vitest.config.ts`, `ci.yml` | Un module de prix peut perdre ses tests sans signal. | Seuils par motif sur `src/lib/pricing/**` et `src/lib/cart/**`, pas de seuil global (A9). |
| T16 | *Levé.* Les scripts nomment leur projet (`test`, `test:run` → `--project unit` ; `test:integration`). | `package.json` | — | — |
| T17 | `.gitignore` ne contient pas `playwright/.auth/`. | `.gitignore` | Un jeton de session de test (8 h) pourrait être commité `[PW2]`. | Ajouter la ligne avec le premier `auth.setup.ts`. |
| T18 | *Changé.* `/panier` attend `useCheckoutSession().ready` = Clerk `isLoaded` **ou** cookie indice du mode test. Avec une session de test, le formulaire s'affiche sans clerk-js ; sans session, il attend clerk-js, injoignable avec les clés factices de la CI (`host_invalid`). | `use-checkout-session.ts`, `[L16]` | Parcours « client » faisable en CI ; parcours « invité par l'écran » non (A2). | [scenarios-e2e.md](scenarios-e2e.md). |
| T19 | `src/lib/__tests__/order-state-machine.test.ts` lit l'heure réelle (`isCancellable(…, new Date())`, 6 lectures). | audit `[L18]`, lecture du fichier | Pas d'instabilité aujourd'hui (cas à 1 min et 10 min pour un seuil de 5 min), mais la borne elle-même (4 min 59 / 5 min 01) ne peut pas être testée de façon stable. | `vi.useFakeTimers()` + `vi.setSystemTime`, puis les deux cas de borne ([vitest-unitaire-et-composants.md](vitest-unitaire-et-composants.md) §4). |

## 4. Défauts du produit mesurés par ce skill

Mesurés sur les vrais handlers et une base réelle, Clerk seul simulé. **Les quatre sont corrigés par le chantier 0** et re-mesurés le 2026-11-14 `[L20]` ; les tests de non-régression existent dans `tests/integration/orders/`.

| # | Défaut (2026-11-13) | Re-mesure 2026-11-14 | Test qui le garde |
|---|---|---|---|
| D1 | `cutPriceCents` envoyé par le client remplaçait le prix en base (`totalCents: 2` au lieu de 2 000). | 400 : le schéma strict refuse le champ. | `create-order.test.ts`, `checkout-contract.test.ts` |
| D2 | `discountCents` choisi par le client, offre d'une autre boutique acceptée (`totalCents: 0`). | 400 ; un total confirmé faux donne 409 `PRICE_CHANGED`, rien n'est créé. | `discount.test.ts`, `quote.test.ts` |
| D3 | Accepter et refuser en même temps : deux 200, deux `OrderEvent`. | 20 essais : toujours un 200 et un 409, un seul `OrderEvent`. | `transition-races.test.ts` |
| D4 | Double envoi avec la même `idempotencyKey` : `[201, 409]`. | `[200, 201]`, une ligne : le rejeu renvoie la commande. | `create-order-concurrency.test.ts` |

Leçon : aucun des quatre n'était visible avec un Prisma simulé (le test simulé fournit le prix qu'il attend ; une simulation n'a ni verrou ni contrainte unique).

## 5. Ce que fait réellement le mode test (depuis `2364ef9`)

Conditions (`src/lib/auth/test-mode-env.ts`) : jamais sur le déploiement de production Vercel ; sinon `TEST_MODE=true` ; sous `next start` (NODE_ENV=production) `ALLOW_TEST_IN_PROD=true` en plus. `TEST_SECRET` ≥ 16 caractères.

Activation : `POST /api/test-mode/activate { secret, role }` pose `klikgo-test-session` (HttpOnly, HMAC-SHA256, rôle, 8 h) et deux cookies indices lisibles (`klikgo-test-activated`, `klikgo-test-role`) sans droit. `PATCH { role }` change de rôle avec une session valide ; `DELETE` ferme. Poser les cookies à la main ne fonctionne plus `[L12]`.

| Rôle du jeton | Serveur | Navigateur |
|---|---|---|
| `CLIENT` | `getServerUserId()` = l'identifiant de `TEST_USERS.CLIENT` (`src/lib/auth/test-auth.ts`) ; « Amina Test » créée en base au premier besoin par `getOrCreateUser`. | `useCheckoutSession()` le voit connecté : `/panier` poste vers `/api/orders`. `/commandes` ne lit que `useUser()` de Clerk : la session de test n'y existe pas (« Connexion requise », ou squelette sans fin tant que clerk-js ne se charge pas, ce qui est le cas avec les clés factices de la CI). `/suivi/<id>` et `/commande/<id>` n'utilisent pas les hooks Clerk (identité lue côté serveur). |
| `BOUCHER` | `getAuthenticatedBoucher()` = **la boutique la plus ancienne** (`orderBy: { createdAt: "asc" }`) : « El Fathe » après le seed. | Le mode cuisine n'utilise pas les hooks Clerk. |
| `ADMIN` | `requireAdmin()` = l'identifiant de `TEST_USERS.ADMIN` ; `getAuthenticatedBoucher()` l'accepte aussi (même boutique). | Idem. |

Le middleware laisse passer **avant Clerk** toute requête portant un jeton valide, quel que soit le rôle.

Conséquences :

1. Le mode test ne prouve **ni l'isolation entre boutiques ni le contrôle des pages par rôle** : il court-circuite la recherche de propriété et le middleware. Ces garanties se prouvent en intégration avec Clerk simulé ([integration-postgres.md](integration-postgres.md) §3) et par le scénario E9 sans session.
2. Tous les parcours boucher partagent une boutique : un test retrouve *sa* commande par un nom de client unique, jamais par une position ou un compteur.
3. Toute requête de préparation part d'un contexte porteur d'une session de test : le middleware ne dépend alors plus des clés Clerk, factices en CI.
