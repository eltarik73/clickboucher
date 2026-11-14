---
name: typescript-patterns
description: Règles de TypeScript propre et sûr pour Klik&Go, au-delà de strict - entrée inconnue analysée une seule fois par Zod à la frontière puis typée, unions discriminées et switch exhaustif, aucun any, as ou ! sans justification, ?? plutôt que || sur des centimes ou des quantités, promesses jamais flottantes, erreurs typées et jamais avalées, identifiants Clerk et Prisma qu'on ne peut pas confondre, immutabilité, nommage, fonctions courtes et commentaires qui disent pourquoi. À charger avant d'écrire, modifier ou relire un fichier .ts ou .tsx, de typer un corps de requête, une colonne Json ou un résultat Prisma, ou face à any, as unknown as, @ts-ignore, eslint-disable, catch, switch, null ou undefined. Pas pour le rendu React (react-patterns), la forme d'une route (api-route-conventions) ni l'activation des règles ESLint ou tsconfig (quality-gates).
when_to_use: TypeScript, typage, any, unknown, as, cast, as unknown as, non-null assertion, ts-ignore, ts-expect-error, eslint-disable, Zod, z.infer, safeParse, union discriminée, switch exhaustif, never, ??, ||, ?? 0, promesse, floating promise, await, catch, Error, erreur métier, instanceof, colonne Json, JSON.parse, openingHours, clerkId, userId, brand, readonly, nommage, paramètre booléen, ternaire imbriqué, commentaire, JSDoc.
---

# TypeScript propre et sûr — Klik&Go

Remplace l'ancien aide-mémoire générique et reprend l'utile de `javascript-expert` et
`nodejs-expert`, qu'il remplace (dossiers retirés le 2026-11-15). Précise `CLAUDE.md` (« Code quality », « Conventions », « Résolution
userId », « Commandes : quantités, prix, totaux ») : ce que Claude ferait autrement ici, et pourquoi.

**Précédence** : `CLAUDE.md` > `seo-anti-penalty` > skills vérifiés du programme > ce skill. Un
désaccord va dans « Points à arbitrer » et se signale pour
`klikgo-programme/references/contradictions-connues.md` ; il ne se tranche pas dans le code. Une
règle qu'un outil peut vérifier s'active par `quality-gates` ; ici, le jugement et la raison.
Voisins à ne pas répéter : `react-patterns`, `api-route-conventions`, `architecture-conventions`
§ 4–6, `reliability-observability` § 2–3, `security-multitenant` § 3, `prisma-expert`.

## Pièges déjà rencontrés ici

1. **`||` sur un montant ou une quantité** : 0 est valable. `adjustedPriceCents || totalPriceCents`
   affiche le prix plein d'une ligne ajustée à 0 (`components/boucher/order-detail.tsx`, sans
   importeur ; le motif court ailleurs : etat-du-code § 1). Inverse interdit aussi : `?? 0` sur un
   prix maquille une absence (`klikgo-programme` § 6 règle 3). `?? 0` n'est juste que si 0 est la
   vraie valeur de l'absence : somme vide (`_sum.x`), aucune remise (`discount?.discountCents`).
2. **`clerkId` comparé à un `User.id`** : coupon refusé à son propriétaire (`e3b1629`,
   `api-route-conventions` § 9). `getServerUserId()` rend un `clerkId`, `Order.userId` un `User.id`.
3. **Colonne `Json` lue par `as`** : `api/shops/register/route.ts` écrit
   `openingHours: JSON.stringify({})`, une _chaîne_ ; `api/boucher/onboarding/route.ts` la relit
   `as Record<string, unknown>` et `Object.keys("{}")` vaut `["0", "1"]` : l'étape « Horaires »
   est cochée pour une boutique sans horaires. `openingHours` est casté dans une douzaine de
   fichiers, sans parseur.
4. **Clés de jour indexées à la main** (`hours.mon`, `openingHours?.[dayKey]`) : les clés stockées
   sont françaises, lire par `getDayHours` (`CLAUDE.md` « Horaires & fuseau »).
5. **`default:` générique sur une union** : `getPushPayload` (`src/lib/notifications.ts`) n'a pas
   de cas pour `PRO_VALIDATED` ni `PRO_REJECTED`, envoyés avec le titre « Klik&Go » par défaut.
6. **`Date` devenue `string`** entre serveur et client (`architecture-conventions` § 5) ; pas de
   `new Date()` dans le rendu initial d'une page statique ou ISR (`CLAUDE.md`).
7. **Erreur avalée** : `catch` vides et `.catch(() => {})` nombreux (etat-du-code § 1).
8. **Commentaire-récit** : `// Labels and colors now imported from …` (`order-state-machine.ts`),
   « (chantier 0, decision 1) » (`cart/cart-line.ts`), « no longer exists (removed in …) » (4 pages).

## 1. Frontières : analyser une fois, puis passer le type

Une donnée qui entre reste `unknown` jusqu'à ce qu'un schéma en fasse un type précis ; ensuite ce
type circule et personne ne revérifie la forme (« parse, don't validate »).

- Entrées : corps, query, params (forme : `api-route-conventions` § 4), webhook, stockage
  navigateur, colonne `Json`, `process.env`, `res.json()` externe, `JSON.parse`. `readJsonBody`
  rend `Promise<unknown>` ; `res.json()` et `JSON.parse` rendent `any` : `const raw: unknown = …`.
- Une seule analyse, dans la première fonction qui reçoit l'`unknown` : la route
  (`api/orders/quote/route.ts` : `safeParse(await readJsonBody(req))` puis
  `quoteOrder(parsed.data, …)`) ou l'entrée de service qui l'annonce (`createOrder(body: unknown)`).
  La suite reçoit le type analysé. Un invariant métier se vérifie dans son autorité (`assertCents`
  dans `src/lib/pricing`), pas à chaque couche.
- Type tiré du schéma (`z.infer`, fin de `src/lib/validators/order.ts`), sans interface recopiée ;
  tout nouveau schéma de requête en `.strict()` (modèle `validators/order.ts`).
- Parseur écrit à la main quand il faut réparer de l'ancien (`normalizeStoredCart`,
  `cart/stored-cart.ts` ; `parseCutOptions`, `pricing/unit-price.ts`) : type précis, `null` ou
  exception, jamais `as`.
- Colonne `Json` : un parseur par colonne, chez son autorité (horaires : `src/lib/shop-hours.ts`) ;
  fichier non attribué au chantier → `besoinsDuChef`, pas un second parseur ailleurs.

```ts
const openingHoursSchema = z.record(
  z.string(),
  z.object({ open: z.string(), close: z.string() }).strict().nullable()
);

export function parseOpeningHours(raw: Prisma.JsonValue): OpeningHours | null {
  const parsed = openingHoursSchema.safeParse(raw);
  return parsed.success ? parsed.data : null; // la chaîne "{}" est refusée, pas lue comme un objet
}
// getDayHours(parseOpeningHours(shop.openingHours), jour) ; null = « horaires non renseignés »
```

## 2. Rendre les états impossibles non représentables

- Union discriminée plutôt que champs optionnels : `CartItem` (`KG`/`TRANCHE` portent
  `weightGrams: number`, `PIECE`/`BARQUETTE` `weightGrams?: undefined`), `StoredLineView`
  (`pricing/line.ts`), `CommandResult<T>` (`commands/outcome.ts`), `TransitionOutcome`.
- Discriminant lu en base (unité du produit) : analyser après la lecture (`inspectLine` →
  `InspectedLine`). Statut : `OrderStatus` de Prisma et tables de `order-state-machine.ts`.
- Exhaustivité : membre → valeur, table `Record<Union, V>` (clé manquante = erreur ; `TRANSITIONS`,
  `STATUS_MAP`) ; membre → code, `switch` dont le `default` affecte à `never` (`serviceFeeCentsFor`,
  `pricing/totals.ts`) ou dont la fonction déclare son retour (`runAction` de la route d'action
  boucher). Un membre refusé exprès a son `case` : `offerGrant` (`pricing/discount.ts`) range
  `BOGO` et `BUNDLE` dans `default`, et un nouveau type d'offre y tomberait en silence.
- `default` générique sur une union : **majeur** en relecture. `tsc`, même avec `noImplicitReturns`,
  ne le voit pas ; la règle `switch-exhaustiveness-check` le signale (etat-du-code § 3).

## 3. Échappatoires : `any`, `as`, `!`, directives

- Pas de `any` : `unknown` puis `typeof` / `instanceof` / `in` / schéma ; type de bibliothèque
  absent → petite interface des membres utilisés ; un `any` restant porte sa justification.
- Aucun `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` dans `src/` : corriger la cause.
- `as T` et `!` : préférer un contrôle à l'exécution, `satisfies T` ou `const x: T = {…}` (champ
  en trop signalé) ; celui qui reste a une ligne disant pourquoi il est sûr. `as const` n'est pas
  un cast. `as unknown as` : **majeur**, sauf le singleton `globalThis` de `src/lib/prisma.ts`.
- Ligne Prisma typée par son `select` : `as const satisfies Prisma.OrderSelect` puis
  `Prisma.OrderGetPayload<{ select: typeof x }>` (`services/orders/kitchen.ts` ; détail
  `architecture-conventions` § 5), jamais une interface écrite à la main.
- Une garde `value is T` qui ne vérifie pas tout ce qu'elle promet est un `as` déguisé.
- `eslint-disable` : sur la ligne, règle nommée, raison après `--`.

## 4. Valeurs absentes et nombres

- `??` dès que 0 ou `""` est valable (`priceCents`, `quantity`, `discountCents`, `weightGrams`).
- Absence = état du type (`number | null`) traité à l'écran, jamais un défaut qui ressemble à une
  donnée. Argent : centimes entiers calculés dans `src/lib/pricing` ; pas d'arithmétique en euros.
- `Number()`, `parseInt`, `parseFloat` suivis de `Number.isFinite` / `Number.isSafeInteger` ;
  query par `z.coerce`. `===` toujours, `== null` toléré.
- `?.` qui saute une étape obligatoire masque une panne : la commande doit exister → rétrécir et
  répondre `not_found`, pas `order?.shop?.name ?? ""`.

## 5. Asynchrone

- Chaque promesse est attendue, retournée, terminée par un `.catch` qui journalise, ou `void`
  avec sa raison ; `void` n'attend pas mais ne gère pas une rejection. « Tirer et oublier »
  seulement dans les cas de `reliability-observability` § 2 (notification après une mutation
  réussie), avec son `.catch`.
- Pas de fonction `async` où l'appelant attend `void` (`setTimeout`, `forEach`, `addEventListener`,
  prop `onX`) : la rejection n'arrive nulle part. `for … of` + `await`, `Promise.all(items.map(…))`,
  ou `() => void run()` si `run` traite ses erreurs. Gestionnaires React : `react-patterns`.
- Appels indépendants : `Promise.all` ; `allSettled` si l'échec partiel est voulu, chaque
  `rejected` journalisé. Dans un `try`, `return await`, sinon le `catch` voisin ne voit rien.

## 6. Erreurs

- On ne lève que des `Error` ou sous-classes, `name` et champs typés
  (`LimitedStockError.productId`, `DiscountUnavailableError.reason`).
- Refus métier attendu : une **valeur** (`{ ok: false, code }`, `refused`), pas une exception
  (`architecture-conventions` § 4).
- Exception qui annule une transaction (`LimitedStockError`, `DiscountUnavailableError`,
  `GuestAdmissionRefusedError`, `StaleOrderError`) : classe dans le service propriétaire, attrapée
  par `instanceof` à sa frontière et convertie en valeur (`creationFailure` de
  `services/orders/create-replay.ts`, `acceptOrder`) ; le reste est relancé.
- Bug ou état impossible (`RangeError` d'`assertCents`, `IllegalTransitionError`) : jamais
  attrapé ; `handleApiError` répond 500 et prévient Sentry.
- `catch (error)` est `unknown` : `instanceof` avant `.message`, jamais `catch (e: any)`, jamais
  reconnaître une erreur à son texte (`prisma-expert` : par code).
- Un `catch` convertit une classe connue, relance avec contexte (`new Error("…", { cause })`,
  modèle `readJsonBody`) ou journalise et continue dans les cas de `reliability-observability`
  § 2 ; il ne rend ni `[]`, ni `null`, ni défaut. Les route handlers gardent `try/catch` →
  `handleApiError` (`CLAUDE.md`) : le conseil externe « éviter try/catch » ne vaut pas ici.
  Détail : [references/erreurs.md](references/erreurs.md).

## 7. Des identifiants qu'on ne peut pas confondre

- `clerkId`, `User.id` et `Shop.id` sont des `string` ; `Shop.ownerId` porte l'un ou l'autre
  (`CLAUDE.md` « Authentification API »). Le nom dit la sorte : `clerkId`, `userId` (Prisma),
  `shopId`.
- La route résout, le service reçoit l'identité résolue (`architecture-conventions` § 4) :
  `customerUserId(clerkId)` (`commands/outcome.ts`) rend `string | null` ; `null` → 401 ou 404,
  jamais un repli `?? clerkId` qui écrit l'autre sorte en base. Action d'un client sur une
  commande : `authorizeOrderAccess` (`src/lib/auth/order-access.ts`) rend `access.customerId`.
- Pilote proposé, statique, coût quasi nul : `z.string().min(1).brand<"DbUserId">()` (Zod v3) ;
  un `ClerkUserId` passé où un `DbUserId` est attendu, ou comparé à lui, ne compile plus. Limite :
  une colonne Prisma reste `string`, `where: { userId: clerkId }` compile encore. Sans contrôle de
  préfixe `user_` (le mode test et le seed ne l'ont pas). Un module à la fois :
  [references/frontieres-zod.md](references/frontieres-zod.md) § 7.

## 8. Immutabilité

- Entrées `readonly` (`computeOrderTotals`), tables `as const` ou `Readonly<Record<…, readonly
…[]>>` ; les tableaux modifiables de `order-state-machine.ts` ne sont pas un modèle.
- Ne jamais muter un argument, une prop, un résultat partagé ou mis en cache (cache mémoire de
  `getAuthenticatedBoucher`) ; muter ce que la fonction a créé est normal.

## 9. Nommage et forme des fonctions

- Un terme par concept, celui du code (`shop`, `order`, `pickup`) ; français dans les textes affichés.
- Unité dans le nom (`priceCents`, `weightGrams`, `estimatedMinutes`, `…At` pour une `Date`,
  `dateKey`) ; booléen en question (`isWeighedUnit`, `holdsLimitedStock`).
- Plus de trois paramètres, ou deux du même type côte à côte : un objet (`{ orderId, shopId,
actorId, now }`). Pas de paramètre booléen qui change le comportement : deux fonctions.
- Clauses de garde plutôt qu'une imbrication de plus de trois niveaux ; pas de ternaire imbriqué ;
  un niveau d'abstraction par fonction ; complexité > 15 = signal (`simplicity-refactoring`).
- Exports nommés ; par défaut seulement où Next l'exige (`page`, `layout`, `loading`, `error`,
  `not-found`, `opengraph-image`, `sitemap`, `robots`) ; `route.ts` exporte `GET` / `POST`. Pas de
  baril `index.ts` (`architecture-conventions` § 2), pas d'`enum` : union ou enum Prisma.

## 10. Commentaires

- Par défaut, aucun. Une phrase pour un **pourquoi** invisible dans le code : contrainte, nombre
  magique, source d'une règle, ordre des verrous (en-tête de `transition.ts`).
- Jamais de récit : ni demande, chantier, ticket, tâche ou commit, ni « désormais », « supprimé »,
  « no longer ». Décrire la donnée (« commandes sans `stockUnits` »), pas l'histoire. Les
  commentaires bavards de Claude sont une plainte publique très soutenue (anthropics/claude-code
  #65961, 257 réactions), et un commentaire daté pourrit au premier changement.
- Ni code commenté ni `TODO` (`klikgo-programme` § 6 règle 5) : le reste à faire va dans
  `besoinsDuChef`. JSDoc seulement sur un helper exporté de `src/lib` au contrat non évident
  (unité, exception, sens de `null`), modèle `lineTotalCents`. Pas de nouvelle bannière `// ── X ──`.

## Procédure : après chaque modification d'un `.ts` ou `.tsx`

1. Relire le diff avec la grille des § 1 à 10, en partant des lignes que ce filtre remonte :
   `git diff -U0 | grep -nE '^\+.*(\bany\b|as unknown as|@ts-|eslint-disable|\|\| *0\b|\?\? *0\b|catch *(\([^)]*\))? *\{ *\}|\.catch\(\(\) *=> *\{ *\}\)|TODO|chantier|désormais|no longer)'`
2. Lancer le contrôle typé des fichiers touchés (commande : etat-du-code § 2 ; coût quasi nul,
   n'écrit rien) : aucun constat nouveau sur une ligne ajoutée.
3. `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run test:integration` si la base est
   touchée. Corriger, relancer ; terminé seulement sorties lues (`verification-before-done`).
4. Une règle qui semble fausse pour un cas : ne pas la contourner, la porter en « Points à
   arbitrer » du rapport.

## Points à arbitrer (propriétaire)

1. Identifiants marqués au-delà du pilote, et `AuthorizedShopId` que seuls les helpers d'auth
   produisent (idée de Rallly) : touchent `security-multitenant` § 3, `architecture-conventions` § 4.
2. Passage en erreur de `no-explicit-any`, des règles typées, de `noImplicitReturns` : `quality-gates`.
3. `CLAUDE.md` « Résolution userId » écrit `dbUser?.id || clerkId`, qui rend un `clerkId` si
   l'utilisateur manque ; ce skill suit `customerUserId` (`string | null`). Pour `contradictions-connues.md`.
4. `openingHours` écrit en chaîne à l'inscription, relu par `as` à l'onboarding (piège 3) :
   correctif et reprise des lignes existantes à confier à un chantier (données réelles).
5. `CLAUDE.md` place `normalizeStoredCart` dans `cart-line.ts` ; il vit dans `stored-cart.ts`.

## Définition de terminé (code TypeScript écrit ou modifié)

- [ ] Entrées `unknown` analysées une fois, type tiré du schéma, aucun `as` sur une colonne `Json`.
- [ ] Unions exhaustives (table `Record` ou `never`), aucun `default` générique.
- [ ] Aucun `any`, `as`, `!`, `@ts-*`, `eslint-disable` ajouté sans justification ; aucun `as unknown as`.
- [ ] `??` là où 0 et `""` comptent ; aucun `?? 0` sur un prix.
- [ ] Contrôle typé (Procédure 2) sans promesse flottante ni `async` passée où `void` est attendu.
- [ ] Refus en valeur ; exception de transaction convertie à la frontière ; aucun `catch` à défaut.
- [ ] Aucune comparaison ni écriture mêlant `clerkId` et `User.id`.
- [ ] Noms avec unité, ni paramètre booléen ni ternaire imbriqué ; aucun récit, `TODO`, code commenté.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test` (et intégration si base) verts, sorties lues.

## Fichiers de référence

- [references/frontieres-zod.md](references/frontieres-zod.md) — avant d'analyser une entrée :
  route, service, stockage navigateur, colonne `Json`, API externe, environnement, identifiants marqués.
- [references/erreurs.md](references/erreurs.md) — avant un `throw`, un `catch`, une classe d'erreur
  ou un appel asynchrone sans `await`.
- [references/etat-du-code.md](references/etat-du-code.md) — avant de citer un chiffre ou de mesurer :
  comptes datés, commandes qui les remesurent, contrôle typé des fichiers touchés.
- [references/sources.md](references/sources.md) — avant d'ajouter une règle venue d'ailleurs.
