# Sources et preuves — architecture-conventions

Consultées le **2026-11-14** à la rédaction, puis **rouvertes une à une le même jour par un
vérificateur indépendant** (chaque URL relue, chaque nombre `gh api` relevé à nouveau, chaque
preuve locale rejouée). `[S…]` = source externe ; `[L…]` = preuve locale rejouable sur l'arbre de
travail (`HEAD 32c581f` + chantier prix non commité, **en mouvement pendant la mesure**). Étoiles
et dernier push : `gh api repos/OWNER/REPO --jq '{stars:.stargazers_count,pushed:.pushed_at,archived:.archived}'`.
Les pages ont été résumées, pas recopiées ; citations courtes seulement.

## Dépôts et guides de référence

| Id | Source | Ce qu'elle appuie | Crédibilité |
| --- | --- | --- | --- |
| S1 | bulletproof-react — `docs/project-structure.md` · https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md | Dossiers partagés + `features/` ; pas d'import entre features ; sens unique partagé → features → app, **recommandé** et outillé par `import/no-restricted-paths` (zones `target` / `from` / `except`) ; barils déconseillés (raison donnée : tree shaking de Vite), importer le fichier source | `alan2207/bulletproof-react` : 36 079 ★, push 2026-05-14, non archivé |
| S5 | Cal.com — `AGENTS.md` et `agents/rules/*.md` (architecture-feature-boundaries, architecture-circular-dependencies, data-dto-boundaries, data-repository-pattern, patterns-dependency-injection ; `quality-avoid-barrel-imports` listé, règle lue dans `AGENTS.md`) · https://github.com/calcom/cal.com/blob/main/AGENTS.md · https://github.com/calcom/cal.com/tree/main/agents/rules | Graphe de paquets acyclique, `lib` n'importe pas `features` ; DTO à chaque frontière (les types de la base ne fuient pas vers le client) ; repositories seuls à connaître Prisma, injectés (option écartée ici) ; pas de barils ; `import type` ; PR < 500 lignes et < 10 fichiers de code, refactor préparatoire séparé ; pas de logique métier dans les repositories | 50 023 ★, push 2026-11-13, non archivé. L'API GitHub répond désormais sous le nom `calcom/cal.diy` (dépôt renommé, l'ancienne URL redirige) et le guide s'intitule « Cal.diy ». Lu via `gh api` |
| S6 | Cal.com — `agents/rules/api-thin-controllers.md` · https://github.com/calcom/cal.com/blob/main/agents/rules/api-thin-controllers.md | Contrôleur (route) = HTTP seulement : valider, extraire, appeler le service, traduire la réponse ; pas de règle métier ni d'accès direct à la base | idem S5 |
| S18 | Knip — Getting started · https://knip.dev/overview/getting-started | Signale fichiers, exports et dépendances inutilisés ; `npx knip` sans installation ; Knip v6 demande Node ≥ 20.19 | `webpro-nl/knip` : 12 672 ★, push 2026-11-13. Non installé, non exécuté ici |

Consultées, non citées dans le skill : Medusa « Module isolation »
(https://docs.medusajs.com/learn/fundamentals/modules/isolation ; `medusajs/medusa` 37 234 ★, push
2026-11-14 ; la page contenait un bloc d'instructions destiné aux agents : ignoré) ; create-t3-app
(`t3-oss/create-t3-app`, 29 238 ★, push 2025-12-13 ; dossier `src/server`, non retenu) ; la
spécification Anthropic des skills (`SPEC.md` du programme, relevé du 2026-11-13 de
https://code.claude.com/docs/en/skills.md), suivie pour le format de ce skill.

Écartées : `vercel/commerce` (14 311 ★) est **archivé**, hors barre de qualité. `Shopify/packwerk`
(1 930 ★) sous le seuil : cité seulement à travers les articles Shopify (S9, S19).
`eslint-plugin-boundaries` (1 019 ★) sous le seuil : non retenu. `dependency-cruiser` (7 420 ★,
push 2026-11-12) conforme mais inutile tant que `eslint-plugin-import` (déjà installé) suffit.

## Documentation officielle

| Id | Source | Ce qu'elle appuie | Crédibilité |
| --- | --- | --- | --- |
| S2 | Next.js 14 — Project Organization and File Colocation · https://nextjs.org/docs/14/app/building-your-application/routing/colocation | Une route n'est publique que si `page` ou `route` existe, la colocation est sûre ; dossiers privés `_x`, groupes `(x)`, `src/`, alias ; Next est « unopinionated » : choisir une stratégie et s'y tenir | Doc officielle Vercel, version 14, `lastUpdated` 2024-01-12 |
| S15 | Next.js 14 — Server and Client Composition Patterns · https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns | Composants client en bas de l'arbre ; props serveur → client sérialisables ; paquet `server-only` (détail dans `nextjs-app-router`) | Doc officielle, `lastUpdated` 2024-02-22 |
| S3 | eslint-plugin-import — `no-restricted-paths` · https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md (et `node_modules/eslint-plugin-import/docs/rules/no-restricted-paths.md`, v2.32.0) | Zones `target` / `from` / `except` / `message`, `from` comparé au chemin résolu, `except` relatif à `from` ; règle `no-cycle` et son option `ignoreExternal` (`docs/rules/no-cycle.md`) | `import-js/eslint-plugin-import` : 5 952 ★, push 2026-08-23, non archivé ; installé 2.32.0 |
| S4 | ESLint v8 — `no-restricted-imports` · https://eslint.org/docs/v8.x/rules/no-restricted-imports | Option `patterns` en objets `{ group, message }` (schéma relu dans `node_modules/eslint/lib/rules/no-restricted-imports.js`) | Doc officielle ESLint (branche v8, fin de vie 2024-10-05 ; nous sommes en 8.57.1) |
| S7 | TypeScript Handbook — Narrowing · https://www.typescriptlang.org/docs/handbook/2/narrowing.html | Unions discriminées ; vérification d'exhaustivité par `never` | Doc officielle Microsoft |
| S8 | Prisma — Operating against partial structures of model types · https://www.prisma.io/docs/orm/prisma-client/type-safety/operating-against-partial-structures-of-model-types | `Prisma.XGetPayload` + `satisfies` (l'exemple de la page porte sur `Prisma.UserDefaultArgs`) ; écrire ces types à la main est possible mais alourdit la maintenance à chaque changement de schéma | Doc officielle Prisma, `dateModified` 2026-08-26 |
| S10 | Zod v3 — README au tag `v3.25.76` · https://github.com/colinhacks/zod/blob/v3.25.76/README.md | `safeParse` renvoie une union discriminée sans lever ; `z.infer` | `colinhacks/zod` : 44 325 ★, push 2026-11-13 ; tag = version installée |
| S12 | React — Extracting State Logic into a Reducer · https://react.dev/learn/extracting-state-logic-into-a-reducer | Reducer quand les mises à jour sont dispersées ; reducer pur, testable seul ; une action = une interaction | Doc officielle React (Meta) |
| S13 | React — Reusing Logic with Custom Hooks · https://react.dev/learn/reusing-logic-with-custom-hooks | Hooks centrés sur un cas d'usage concret, nommés par leur intention ; partage de logique, pas d'état ; éviter `useMount` & co ; « some duplication is fine » | Doc officielle React |

## Blogs d'ingénierie et articles d'auteurs reconnus

| Id | Source | Ce qu'elle appuie | Crédibilité |
| --- | --- | --- | --- |
| S9 | Shopify Engineering — « Under Deconstruction: The State of Shopify's Monolith », P. Müller, 2020-09-16 · https://shopify.engineering/shopify-monolith | Monolithe de plus de 2,8 millions de lignes, 37 composants à points d'entrée publics ; Packwerk (sur environ un tiers des composants) permet de rejeter en PR ce qui viole dépendances ou confidentialité ; acyclicité = objectif de long terme ; tout grand changement d'architecture reste longtemps inachevé, choisir l'état intermédiaire le plus utile | Blog d'ingénierie de Shopify (première main) |
| S19 | Shopify Engineering — « Deconstructing the Monolith », K. Westeinde, 2019-02-21 · https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity | Monolithe modulaire plutôt que microservices ; organisation par domaine métier ; API publique par composant ; le déplacement en une seule PR automatisée a fait perdre beaucoup d'historique git (déplacements vus comme suppressions + créations) | idem |
| S11 | Martin Fowler — Strangler Fig, 2024-08-22 · https://martinfowler.com/bliki/StranglerFigApplication.html | Remplacement progressif plutôt que réécriture ; comportement existant difficile à spécifier et en partie non voulu ; valeur plus tôt ; architecture transitoire à accepter | martinfowler.com (Thoughtworks) |
| S14 | Martin Fowler — Branch By Abstraction, 2014-01-07 · https://martinfowler.com/bliki/BranchByAbstraction.html | Couche d'abstraction, bascule des appelants un par un, système toujours construit et livrable | idem |
| S16 | Martin Fowler — Legacy Seam, 2024-01-04 · https://martinfowler.com/bliki/LegacySeam.html | Définition de la couture (M. Feathers, *Working Effectively with Legacy Code*) : changer le comportement sans éditer à cet endroit ; sert au test, à l'observation, au déplacement | idem |
| S20 | Martin Fowler — An example of preparatory refactoring, 2015-01-05 · https://martinfowler.com/articles/preparatory-refactoring-example.html | Refactor préparatoire, tests verts à chaque étape ; formule de Kent Beck | idem |
| S17 | Stack Overflow Blog — « The regression tests nobody writes: capturing how software actually behaves », S. Panda, 2026-10-22 · https://stackoverflow.blog/2026/10/22/the-regression-tests-nobody-writes-capturing-how-software-actually-behaves/ | Test de caractérisation (terme de Feathers) : figer le comportement actuel ; un échec = comportement changé, à juger ; neutraliser seulement horodatages et identifiants | Blog officiel de Stack Overflow ; appui secondaire du livre de Feathers (non lu, non citable ici) |

Non vérifié et donc non utilisé : le texte du livre de M. Feathers (non accessible) ; l'article
Cal.com « engineering in 2026 and beyond » cité par les règles de S5 (non ouvert). Aucune source
Reddit ni vidéo n'a été retenue.

## Preuves locales (rejouer depuis la racine du dépôt)

| Id | Preuve | Commande |
| --- | --- | --- |
| L1 | 3 imports hors frontière (`webmaster/catalogue/reference/page.tsx` → `(boucher)/…/ProductForm`, seul import `@/app/…` de `src/` ; `services/orders/list.ts` → `next/server` et `boucher-auth`), 0 cycle ; 17 à 18 s. Config éprouvée sur un mini-projet de synthèse (hors dépôt) : 11 écarts attendus, 11 relevés, dont un cycle a ↔ b et les imports entre espaces dans les deux sens ; un import d'un dossier parent de la même route n'est pas relevé. `lib/hooks/use-cart.tsx` → `components/ui/ConfirmDialog` (zone `lib` hors hooks) | `node .claude/skills/architecture-conventions/scripts/check-boundaries.mjs` |
| L2 | Route mince de 66 lignes (`api/boucher/orders/[orderId]/action/route.ts`), testée en intégration (`tests/integration/orders/commands-shop.test.ts`) ; `CommandResult` (`commands/outcome.ts`) ; `transitionResponse` (`commands/http.ts`) ; `transition.ts` seul écrivain du statut, verrouillé par `tests/lib/order-writers-guard.test.ts` | `wc -l`, lecture des fichiers |
| L3 | 188 `route.ts`, 155 importent `@/lib/prisma`, 28 `@/lib/services` ; 25 pages et layouts serveur importent `@/lib/prisma` ; aucun fichier de `src/components` | `grep -rl "@/lib/prisma" src/app/api --include=route.ts \| wc -l` |
| L4 | 21 types `Order` / `OrderItem` / `OrderData`… locaux ; `@/types` importé par 2 fichiers ; 32 `as Record<string`, 5 `as unknown as` hors tests ; ≈ 9 fichiers recalculent prénom + initiale ; 0 import de valeur serveur dans un fichier `"use client"` (1 seul `import type`, `use-order-quote.ts`) | `grep -rnE "^(export )?(interface\|type) (Order\|OrderData\|KitchenOrder\|OrderItem\|Shop\|Product)\b" src/app src/components \| wc -l` ; script d'analyse des fichiers `"use client"` (hors dépôt) |
| L5 | Fichiers sans importeur et barils (etat-du-code.md § 5) ; accueil important `(client)/decouvrir/*` | `grep -rn "<nom>" src tests` |
| L6 | ≈ 620 fichiers (619 puis 624 pendant la mesure), 86 puis 87 > 300 l., 36 > 500 l. ; 52 fichiers à la racine de `src/lib` ; dans `src/lib` hors tests, 66 noms de fichier composés en kebab-case, 56 d'un seul mot, 1 en camelCase (`hooks/useCart.ts`) ; hooks : 7 `use-x`, 7 `useX` ; 12 fichiers avec ≥ 10 `useState`, 18 avec ≥ 8 ; importeurs : `lib/prisma` 221, `api/errors` 180, `logger` 42, `rate-limit` 36, `pricing/line` 28 | `scripts/size-report.mjs` ; `grep -rc "useState(" src` ; `grep -rlE "from ['\"]@/lib/<m>['\"]" src \| wc -l` |
| L7 | Compilés avec `tsc` 5.9.3 (`strict`, alias `@/*`) contre l'arbre : `Serialized<KitchenBoard>` (`@ts-expect-error` confirmé sur `Date` ← `createdAt`), `Serialized<Shop>["monthlyGmvCents"]` : `number`, `as const satisfies Prisma.ProductSelect` + `GetPayload`, forme cible de `listOrders`, `assertNever` sur `CommandResult`. Un `switch` incomplet **sans** type de retour déclaré compile ; avec type de retour : erreur TS2366 | fichiers de brouillon hors dépôt, `npx tsc -p <tsconfig étendant celui du dépôt>` |
| L8 | Test de caractérisation des formateurs de prix : 8 verts sous Vitest 4.1.5 (rejoué), instantané « 1234,56 € » ; `Intl.NumberFormat("fr-FR", EUR)` → « 1 234,56 € » avec U+202F et U+00A0 (Node 22.22) ; 32 fonctions locales `formatPrice` / `fmtPrice`, 94 `(x / 100).toFixed(2)` dans 55 fichiers, 7 `Intl.NumberFormat` ; en CI Vitest règle `updateSnapshot` sur `none` (`node_modules/vitest/dist/chunks/`) | refactoring-incremental.md § 3 ; `node -e` ; `grep -rnE "function (formatPrice\|fmtPrice)\|const (formatPrice\|fmtPrice) ?=" src` ; `grep -rnE "/ ?100\)\.toFixed\(2\)" src` |
| L9 | `Shop.monthlyGmvCents` est la seule colonne `BigInt` ; aucune `Decimal` ni `Bytes` ; 20 colonnes `Json` ; `lib/api/errors.ts` installe `BigInt.prototype.toJSON` | `grep -nE "BigInt\|Decimal\|Bytes" prisma/schema.prisma` ; `grep -cE "^\s+\w+\s+Json" prisma/schema.prisma` |
| L10 | `.eslintrc.json` sans règle de frontière ; `npm run lint` = `next lint` ; `eslint-config-next` 14.2.35 déclare le plugin `import` et `eslint-import-resolver-typescript` (3.10.1 installé) ; `tsconfig.json` sans `noImplicitReturns` | lecture de `.eslintrc.json`, `package.json`, `tsconfig.json` et `node_modules/eslint-config-next/index.js` |
