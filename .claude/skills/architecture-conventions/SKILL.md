---
name: architecture-conventions
description: Organisation du code de Klik&Go (monolithe Next.js 14.2.35, ~620 fichiers dans src/, plusieurs équipes en parallèle) — où placer un fichier (app, components, hooks, lib, lib/services/<domaine>), sens des dépendances et leur vérification par ESLint, frontière route → service → Prisma, résultats de service typés, contrats JSON entre serveur et client (projections, Serialized<T>, colonnes Json), noyau partagé, taille des fichiers et nommage, découpage des pages et composants géants, refactoring incrémental sans réécriture (tests de caractérisation d'abord, étrangleur, branche par abstraction). À charger avant de créer un fichier ou un dossier, déplacer du code, découper un gros fichier, extraire un service ou refactorer.
when_to_use: Où mettre ce fichier ou ce helper ; nouveau dossier dans src/lib ; page.tsx de 800 lignes, composant avec 20 useState ; extraire un hook, un reducer, un sous-composant ; logique métier dans un route.ts ou une page ; service qui reçoit NextRequest ou appelle getAuthenticatedBoucher ; import d'une route depuis une autre (webmaster → boucher) ; type Order redéclaré dans une page ; Date devenue string côté client ; lire une colonne Json Prisma ; formatPrice dupliqué ; barrel index.ts ; fichier mort, doublon ; refactor, réécriture, dette technique, strangler, test de caractérisation ; taille de PR.
---

# Conventions d'architecture — Klik&Go

Versions lues dans `node_modules` le 2026-11-14 : Next 14.2.35, React 18.3.1, TypeScript 5.9.3,
ESLint 8.57.1 + `eslint-plugin-import` 2.32.0 + `eslint-import-resolver-typescript` 3.10.1,
Zod 3.25.76, Prisma 6.19.2, Vitest 4.1.5. Ce skill précise `CLAUDE.md` (« Structure du projet »,
« Code quality », « Conventions de nommage ») sans le contredire : un désaccord va en § 10.
`[S…]` = source externe, `[L…]` = preuve locale rejouable ([references/sources.md](references/sources.md)).

**Arbre en mouvement.** Le chantier « prix des commandes » (non commité) modifie encore
`src/lib/services/orders/`, `src/lib/pricing/` et les routes de commande : des fichiers sont apparus
pendant la vérification de ce skill (`customer-view.ts`, `adjustment-settlement.ts`). Relire un
fichier avant d'en citer un export ; relancer les scripts du § 3 avant de citer un chiffre.

Voisins, à ne pas dupliquer : `api-route-conventions` (anatomie d'un `route.ts`, fabriques),
`nextjs-app-router` (Server/Client Components, `server-only`, ISR), `testing-strategy`, `prisma-expert`,
`security-multitenant` (projections, périmètre boutique), `order-lifecycle-realtime`, `design-klikgo`.

## 1. Principes (dans cet ordre)

1. **Un seul sens de dépendance** : `app` → `components` / `hooks` → `lib` ; jamais l'inverse,
   jamais entre deux espaces de routes. Bulletproof-react le recommande et l'outille par ESLint
   [S1] ; Cal.com refuse tout cycle entre paquets [S5] ; Shopify vise un graphe acyclique [S9].
2. **Les règles métier vivent dans `src/lib/<domaine>/`, pas dans les routes ni les pages.** Une
   route traduit HTTP ↔ appel de service [S6] ; règle de décision au § 4.
3. **Une seule autorité par règle** (déjà la règle des prix dans `CLAUDE.md`) : un helper, un type,
   un schéma par concept. Une copie locale « pour aller vite » est une dette, pas un raccourci.
4. **Changer par petits pas vérifiés** : test de caractérisation, puis déplacement à comportement
   constant, puis changement de comportement, dans des PR séparées [S11][S14][S16][S20].

## 2. Où va quoi

| Couche | Dossier | Contient | Peut importer | Ne doit jamais importer |
| --- | --- | --- | --- | --- |
| Routes | `src/app/**` | `page`, `layout`, `route.ts`, fichiers privés à la route (`XxxClient.tsx`) | tout ce qui suit ; un fichier de son propre dossier ou d'un dossier parent de la même route | un autre espace (`(boucher)`, `(client)`, `(admin)`, `(auth)`, `webmaster`, `api`) ; une route sœur |
| UI partagée | `src/components/<domaine>/`, `components/ui/` | composants réutilisés par ≥ 2 routes ; données reçues en props | `hooks`, `lib` (types, helpers purs) | `src/app` ; une valeur de `lib/services`, `lib/prisma` ou d'un helper d'auth |
| Hooks client | `src/hooks/` (+ `src/lib/hooks/` existant) | état, effets, polling, `fetch` ; pas de JSX (un provider va dans `components/providers/`) | `lib` | `src/app` |
| Domaine | `src/lib/services/<domaine>/`, `lib/pricing`, `lib/cart`, `lib/validators` | règles, transactions Prisma, calculs purs | `lib/prisma`, `lib/*` | `src/app`, `components`, `hooks`, `next/server`, `next/headers`, `next/navigation`, helpers d'auth |
| Noyau partagé | `lib/prisma.ts`, `logger.ts`, `api/errors.ts`, `paris-time.ts`, `shop-hours.ts`, `order-state-machine.ts`, `roles.ts`, `rate-limit.ts` | briques stables, très importées [L6] | le noyau | tout ce qui est au-dessus |

- Code utilisé par **une seule** route : à côté de sa `page.tsx` (colocation sûre : seuls `page` et
  `route` sont routables [S2]). Dès qu'une deuxième route en a besoin : `src/components/<domaine>/`
  ou `src/lib/`. Deux routes filles peuvent partager un fichier de leur dossier parent
  (`produits/nouveau` et `produits/[id]/modifier` → `../ProductFormPage`).
- Nouveau domaine métier : `src/lib/services/<domaine>/`, un fichier par verbe (`create.ts`,
  `quote.ts`, `commands/accept.ts`). Par défaut, pas de nouveau fichier à la racine de `src/lib/`
  (52 déjà [L6]) : seulement une brique transversale du noyau, justifiée dans la PR.
- Schéma Zod partagé entre client et serveur : `src/lib/validators/<domaine>.ts` (modèle
  `validators/order.ts`) ; schéma propre à un seul service : à côté de lui (modèle
  `commands/action-schema.ts`). `src/lib/validations/` (2 fichiers) est un doublon : n'y rien ajouter.
- Pas de nouveau barrel `index.ts` qui ré-exporte : importer le fichier source [S1][S5]. Les barils
  `components/layout/index.ts` (aucun importeur) et `lib/hooks/useCart.ts` sont à retirer [L5].
- Types de domaine : dérivés du code qui les produit (§ 5), pas dans `src/types/index.ts` (importé
  par 2 fichiers [L4]) sauf pour les types transverses déjà présents.

## 3. Vérifier les frontières (avant toute PR qui crée, déplace ou importe)

```bash
# depuis la racine du dépôt, lecture seule
node ${CLAUDE_SKILL_DIR}/scripts/check-boundaries.mjs   # ~20 s ; sortie 0 = propre, 1 = écarts, 2 = n'a pas pu tourner
node ${CLAUDE_SKILL_DIR}/scripts/size-report.mjs 300 25
```

`check-boundaries` lance ESLint avec `import/no-restricted-paths`, `import/no-cycle` et
`no-restricted-imports` [S3][S4] (config : [scripts/boundaries.eslintrc.cjs](scripts/boundaries.eslintrc.cjs),
chaque zone éprouvée sur un mini-projet de synthèse [L1]). État au 2026-11-14 : **aucun cycle**,
**3 imports hors frontière** [L1] — à ne pas augmenter :
- `webmaster/catalogue/reference/page.tsx` importe `ProductForm` depuis `(boucher)/boucher/produits/` ;
- `lib/services/orders/list.ts` importe `NextRequest` et `getAuthenticatedBoucher`.

Non couvert : un import entre routes sœurs du même espace (l'accueil importe `./decouvrir/*`, § 9).
Une PR qui ajoute une ligne à cette sortie est refusée en revue ; rien ne l'automatise encore (§ 10 n° 1).

## 4. La frontière route → service → Prisma

**Route ou service ?** Reste dans le handler (ou la page serveur) : une lecture ou une écriture
d'**un** modèle, bornée par `shopId` / `userId`, avec `select`, sans règle métier (c'est l'anatomie
de `api-route-conventions`). Va dans `src/lib/services/<domaine>/` dès que l'un de ces cas se
présente : transaction ou plusieurs modèles écrits ; règle de statut, de prix, de stock, de remise,
de créneau ; même logique appelée depuis ≥ 2 points d'entrée (route, cron, page serveur) ; effet
externe (notification, e-mail, push) ; handler de plus de ~40 lignes (seuil de `api-route-conventions`).

Le modèle à copier : `api/boucher/orders/[orderId]/action/route.ts` (66 lignes) → commandes de
`lib/services/orders/commands/` → `transition.ts` [L2]. Règles d'un service :

| Faire | Ne pas faire | Pourquoi |
| --- | --- | --- |
| La route authentifie, valide (Zod), passe une **identité résolue** (`shopId`, `userId` Prisma, rôle) ; pour une action du client, elle convertit le `clerkId` en `User.id` par `customerUserId` (`commands/outcome.ts`) | Le service appelle `getServerUserId` / `getAuthenticatedBoucher` ou lit `req` | Service testable en intégration sans requête HTTP ; une seule autorité d'auth [S6] |
| Paramètres typés `{ orderId, shopId, actorId, now }` | `NextRequest`, `searchParams`, `Response` dans un service (même en `import type`) | La traduction HTTP reste dans la route, ou dans **un** fichier dédié qui ne fait que mapper résultat → `apiSuccess` / `apiError` (`commands/http.ts`) [S6] |
| Résultat en **union discriminée** : `{ kind: "done" \| "replay" \| "not_found" \| "conflict" \| "refused" }` (`commands/outcome.ts`) ou `{ ok: true, … } \| { ok: false, code, message }` (`create.ts`) | `throw` pour un refus métier ; `orders: unknown[]` | Chaque cas est traité explicitement [S7] |
| `switch` rendu exhaustif par le compilateur : type de retour **déclaré** (modèle `runAction` de la route modèle) ou `default` affecté à `never` (modèle `serviceFeeCentsFor`, `pricing/totals.ts`) | `switch` sans type de retour ni `default` : un cas oublié compile et renvoie `undefined` [L7] | Ajouter un `kind` doit casser la compilation partout où il n'est pas traité [S7] |
| `throw` pour une erreur de programmation (`IllegalTransitionError`) | 409 pour un bug | Distinguer bug et refus |
| `now: Date` reçu en paramètre (commandes, `adjustment-settlement.ts`) | `new Date()` enfoui dans un nouveau service (`create.ts`, `getKitchenBoard` le font encore : ne pas imiter) | Tests déterministes ; l'heure de Paris se calcule par `paris-time.ts` |
| `select` / `include` déclarés **une fois** et exportés avec leur type (`orderInclude`, `customerOrderSelect`, `public-projections.ts`) | La même requête recopiée dans plusieurs routes (155 `route.ts` sur 188 importent Prisma [L3]) | Une projection = un contrat, et la frontière de ce qui sort |
| Effets externes (notifications) **après** commit, déclenchés par le service | Notification dans la transaction ou recopiée dans chaque route | Règle de `transition.ts` |

Forme cible de `list.ts` (compilée contre l'arbre du 2026-11-14 [L7]) :

```ts
export type OrderListViewer =
  | { role: "ADMIN" }
  | { role: "BOUCHER"; shopIds: readonly string[] }
  | { role: "CLIENT"; userId: string };          // userId = User.id Prisma, jamais le clerkId

export async function listOrders(viewer: OrderListViewer, query: OrderListQuery): Promise<ListOrdersResult>
```

Pas de couche « repository » séparée ni d'injection de dépendances : Prisma reste dans les services,
testés sur PostgreSQL réel (`CLAUDE.md` § Tests). Cal.com fait l'inverse [S5] : § 10 n° 3.

## 5. Contrats typés entre serveur et client

- **Le serveur exporte le type, le client l'importe avec `import type`** (modèle : `use-order-quote.ts`
  importe `OrderQuote` de `services/orders/quote.ts`). Jamais d'import de *valeur* de `lib/services`,
  `lib/prisma` ou d'un helper d'auth dans un fichier `"use client"` : 0 aujourd'hui [L4], à garder.
- **Ne pas redéclarer un type de domaine dans une page** : 21 `type Order` / `OrderItem` / `OrderData`…
  écrits à la main dans `app/` et `components/` [L4], et `KitchenOrder` (hook) recopie `KitchenRow`
  (service). Chaque nouvelle page dérive son type :
  ```ts
  import type { KitchenBoard } from "@/lib/services/orders/kitchen";
  import type { Serialized } from "@/lib/api/json";        // à créer : references/contrats-types.md
  type KitchenBoardJson = Serialized<KitchenBoard>;          // createdAt: string, totalCents: number
  ```
  `Serialized<T>` convertit `Date` → `string` et `bigint` → `number` (`Shop.monthlyGmvCents` est un
  `BigInt`, rendu en nombre par le correctif `toJSON` de `lib/api/errors.ts`).
- **Formes Prisma** : `const x = { … } as const satisfies Prisma.ProductSelect` puis
  `Prisma.ProductGetPayload<{ select: typeof x }>` (modèles `public-projections.ts`,
  `customer-view.ts`) [S8][L7]. Pas de type partiel écrit à la main : à resynchroniser à chaque
  changement du schéma [S8].
- **Colonnes `Json`** (20 dans le schéma) : lues par **un** parseur à la frontière, qui renvoie un type
  ou refuse (modèle `parseCutOptions`, `pricing/unit-price.ts` ; `openingHours` se lit par
  `getDayHours`, règle de `CLAUDE.md`). Pas de `as Record<string, …>` dispersé (32 occurrences [L4]). Un schéma Zod +
  `safeParse` convient [S10].
- Détail, recette `Serialized<T>` et pièges : [references/contrats-types.md](references/contrats-types.md).

## 6. Taille, nommage, duplication

- **Fichier < 300 lignes** (`CLAUDE.md`). ≈ 86 fichiers dépassent, 36 dépassent 500 [L6]. Règle
  d'équipe : on ne fait **pas grossir** un fichier déjà au-dessus ; toute PR qui le touche en sort
  au moins un bloc (§ 7). Une exception se justifie par un commentaire d'en-tête (données
  déclaratives comme `seo/cities.ts`).
- **Signaux de découpage** (heuristique d'équipe) : ≥ 8 `useState` dans un composant (18 fichiers ;
  12 en ont ≥ 10 [L6]), plusieurs `useEffect` avec `fetch`, `fetch` écrit dans un gestionnaire du
  JSX, fonction de rendu qui définit d'autres composants, helpers de formatage en tête de page.
- **Nommage tel qu'il est** : composants PascalCase (`KitchenOrderCard.tsx`) ; primitives shadcn en
  minuscules (`components/ui/button.tsx`) ; modules de `src/lib` en kebab-case (66 noms composés
  contre 1 en camelCase [L6], alors que `CLAUDE.md` dit camelCase : § 10 n° 2) ; route API
  `app/api/<ressource>/route.ts`. Hooks : `use-xxx.ts` pour un nouveau hook (forme des exemples de
  `CLAUDE.md` : `use-cart`, `use-order-polling`) ; l'existant est partagé 7 / 7 avec `useXxx.ts` [L6].
- **Avant d'écrire un helper, chercher l'existant** (`grep -rnE "function (formatPrice|fmtPrice)" src`).
  Doublons connus : prix (`utils.formatPrice`, `format-kitchen.formatPriceCents`, 32 copies locales
  `formatPrice` / `fmtPrice`, 94 `(x / 100).toFixed(2)`, 7 écrans en `Intl.NumberFormat` qui
  affichent « 1 234,56 € » quand les autres affichent « 1234,56 € » [L8]) ; nom `Prénom.N`
  (`formatClientName` + ≈ 9 réécritures [L4]).
  Liste complète et fichiers morts : [references/etat-du-code.md](references/etat-du-code.md).

## 7. Découper une page ou un composant géant

Ordre, une PR par étape, comportement inchangé jusqu'à la dernière [S11][S14] :

1. **Caractériser** : figer ce que fait le code aujourd'hui (§ 8) — sorties des helpers, payload
   envoyé, rendu des cas clés.
2. **Extraire les fonctions pures** vers `src/lib/<domaine>/` avec un test unitaire (règle de
   `CLAUDE.md`), ou remplacer par le helper existant après un test d'équivalence.
3. **Extraire l'état** : mises à jour dispersées → `useReducer` dont le reducer pur est testé
   (modèle `cartReducer`, `lib/cart/cart-line.ts`) [S12] ; chaque effet (`fetch`, minuteur) → un
   hook nommé par son intention (`useAvailableSlots`), jamais `useMount` [S13]. Tout rafraîchissement
   réseau périodique passe par `useVisiblePolling` (`CLAUDE.md`).
4. **Extraire les sous-composants** de présentation, à côté de la page s'ils lui sont propres
   (`commandes/KitchenColumn.tsx`), dans `components/<domaine>/` sinon. Props typées, pas de fetch.
5. **Réduire la zone client** (facultatif) : îlot `"use client"` en bas de l'arbre [S15]. Ne jamais
   rendre dynamique une page statique ou ISR pour y charger des données (`CLAUDE.md` § Coût CPU
   Vercel) : lire `nextjs-app-router` et `vercel-cost-performance` avant.

Plans détaillés pour `boucher/commandes/page.tsx` (1 274 l.), `panier/page.tsx` (805 l.),
`commande/[id]/page.tsx` (874 l.) et le doublon `ProductForm` / `ProductFormPage` (3 572 l.) :
[references/decoupage.md](references/decoupage.md).

## 8. Refactorer sans réécrire

- **Pas de réécriture d'un bloc** : remplacement progressif, ancien et nouveau coexistent, chaque
  étape livrable [S11]. Le chantier 0 suit ce schéma : `transition.ts` est le seul écrivain du
  statut (hors webhook Stripe, inactif), verrouillé par `tests/lib/order-writers-guard.test.ts` [L2].
- **Test de caractérisation d'abord** : il fige le comportement *actuel*, pas le comportement
  voulu ; un échec signifie « comportement changé », à décider en revue [S17]. Modèle :
  `tests/integration/checkout-contract.test.ts` (12 paniers). Gabarit exécuté :
  [references/refactoring-incremental.md](references/refactoring-incremental.md).
- **Coutures et branche par abstraction** : introduire la fonction cible, y faire passer un appelant
  à la fois, supprimer l'ancien chemin quand plus rien ne l'appelle [S14][S16].
- **Garde statique** après migration : un test qui liste les fichiers autorisés (modèles
  `order-writers-guard.test.ts`, `middleware-matcher.test.ts`) ou une zone ESLint (§ 3).
- **PR petites** : un seul objet ; refactor préparatoire séparé de la fonctionnalité [S20][S5]
  (Cal.com : < 500 lignes, < 10 fichiers de code).

## 9. Erreurs déjà commises ici

- Formulaire produit dupliqué en deux fichiers de ~1 800 lignes (en-têtes « TODO(refactor) ») ;
  `ProductForm.tsx` vit dans l'espace boucher alors que son **seul** importeur est `webmaster` [L1].
- Service `orders/list.ts` qui lit `NextRequest` et appelle l'auth boucher, renvoie `unknown[]` [L1].
- Fichiers sans importeur : 3 anciens `*.service.ts`, 3 composants `boucher/`, 2 fichiers `layout/`,
  `lib/seo/indexnow.ts` doublon de `lib/indexnow.ts` (avant de toucher : `seo-anti-penalty`) [L5].
- L'accueil `/` importe 4 composants depuis `(client)/decouvrir/`, réduite à une redirection [L5].
- `src/lib/hooks/use-cart.tsx` (dans `lib`) importe `components/ui/ConfirmDialog` [L1].
- 32 copies de `formatPrice` : chaque page a recopié le helper au lieu de l'importer [L8].
- Panier pré-multiplié par le poids (mars 2026) : deux autorités pour une même règle ; corrigé par
  `cart-line.ts` + test de contrat (en-tête de `checkout-contract.test.ts`).

## 10. Points à arbitrer (propriétaire)

1. **Brancher `boundaries.eslintrc.cjs` dans `.eslintrc.json`** après correction des 3 écarts : la
   CI bloquerait toute régression (≈ 20 s de lint en plus, mesuré isolément [L1]).
2. **Nommage des utilitaires et des hooks** : `CLAUDE.md` dit camelCase (`getProductImage.ts`, qui
   n'existe pas), le code de `src/lib` est en kebab-case [L6] ; les hooks sont partagés entre
   `use-x.ts` et `useX.ts`. Proposition : acter le kebab-case dans `CLAUDE.md`.
3. **Couche repository + DI** (Cal.com [S5]) : écartée ici (taille, tests sur base réelle). À rouvrir
   seulement si un second ORM ou un service extrait devient réel.
4. **Dossiers par domaine** (`src/features/<domaine>` façon bulletproof-react [S1]) : non adopté ; on
   garde `lib/services/<domaine>` + `components/<domaine>`. Un déplacement massif a coûté à Shopify
   une partie de l'historique git [S19] : uniquement fichier par fichier, quand on le touche.
5. **Format monétaire canonique** (« 1234,56 € » ou « 1 234,56 € ») et son emplacement
   (`lib/pricing/format.ts`, qui ne formate aujourd'hui que poids et quantités).
6. **Détection du code mort** : `knip` [S18] en devDependency (non installé, non exécuté).
7. **`src/hooks` et `src/lib/hooks`** : fusionner dans `src/hooks/` lors des prochains passages.

## 11. Définition de terminé

- [ ] `check-boundaries.mjs` : sortie 0 ou 1 (jamais 2), pas plus d'écarts qu'avant (3 au
      2026-11-14), aucun cycle.
- [ ] Aucun fichier modifié n'a grossi au-delà de 300 lignes ; `size-report.mjs` pas pire.
- [ ] Règle métier nouvelle dans `src/lib/services/<domaine>/` ou `src/lib/<domaine>/` (critères du
      § 4), testée : unitaire si pure, intégration si Prisma — jamais de mock Prisma.
- [ ] Service : identité et `now` en paramètres, résultat en union discriminée traité par un
      `switch` exhaustif, aucun import `next/*` ni helper d'auth.
- [ ] Types côté client importés (`import type`) ou dérivés (`Serialized<…>`), pas redéclarés.
- [ ] Pas de helper dupliqué (`grep` fait), pas de barrel, pas de `.bak`, pas de code commenté.
- [ ] Refactor : test de caractérisation vert **avant** et **après**, PR sans changement de
      comportement, séparée de la fonctionnalité.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:integration` si service.

## Références

- [references/etat-du-code.md](references/etat-du-code.md) — inventaire mesuré : arbre, tailles, doublons, fichiers morts, écarts.
- [references/contrats-types.md](references/contrats-types.md) — `Serialized<T>`, projections Prisma, colonnes Json, résultats de service.
- [references/decoupage.md](references/decoupage.md) — plans de découpage des fichiers géants.
- [references/refactoring-incremental.md](references/refactoring-incremental.md) — étrangleur, caractérisation, gabarits.
- [references/sources.md](references/sources.md) — sources externes et preuves locales.
- `scripts/check-boundaries.mjs`, `scripts/boundaries.eslintrc.cjs`, `scripts/size-report.mjs` — lecture seule.
