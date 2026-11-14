# Frontières : analyser une entrée une seule fois

## Sommaire

1. Le principe en une table
2. Corps, query et params d'une route
3. Service qui reçoit `unknown`
4. Stockage navigateur
5. Colonnes `Json` (lecture et écriture)
6. Réponse d'une API externe, webhook
7. Identifiants marqués : le pilote
8. Variables d'environnement

Exemples écrits pour ce skill dans les formes de Klik&Go et compilés contre les types du dépôt
(`tsc --noEmit`, `strict`) ; ils ne sont pas dans `src/`. Les chemins cités, eux, existent.

## 1. Le principe en une table

| Étape           | Fait                                                                                                                     | Ne fait pas                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Frontière       | reçoit `unknown`, analyse par un schéma Zod (`safeParse`) ou un parseur nommé, rend un type précis, `null` ou une erreur | `as T`, `any`, lire un champ avant l'analyse          |
| Intérieur       | reçoit le type analysé (`OrderQuoteRequest`, `CartState`)                                                                | refaire un `safeParse` sur une valeur déjà typée      |
| Autorité métier | vérifie ses invariants (`assertCents`, `checkLineQuantity`)                                                              | dupliquer ces contrôles dans la route et dans l'écran |

La forme d'une donnée se vérifie une fois ; une règle métier vit dans son autorité unique
(`klikgo-programme` § 6 règle 7). Analyser par morceaux au fil du code, puis agir avant d'avoir
tout analysé, laisse passer des états à moitié valides (« shotgun parsing », Alexis King).

## 2. Corps, query et params d'une route

La forme complète (fabriques, `body:` / `query:` / `params:` déclarés, `z.coerce`, bornes,
`.strict()` sur l'argent) appartient à `api-route-conventions` § 4. Ce qui relève d'ici :

- Une seule analyse par entrée. Modèle : `src/app/api/orders/quote/route.ts`
  (`orderQuoteRequestSchema.safeParse(await readJsonBody(req))`, puis `quoteOrder(parsed.data, …)`).
- Le type exporté vient du schéma : `export type OrderQuoteRequest = z.infer<typeof
orderQuoteRequestSchema>` (`src/lib/validators/order.ts`). Une interface écrite à côté finit par
  diverger du schéma.
- `readJsonBody` (`src/lib/api/request-body.ts`) rend `Promise<unknown>` et transforme un JSON mal
  formé en `InvalidJsonBodyError` (400). `await req.json()` rend `any` et, mal formé, un 500.

## 3. Service qui reçoit `unknown`

`createOrder(body: unknown, customer)` (`src/lib/services/orders/create.ts`) analyse lui-même par
`createOrderSchema.safeParse(body)` et rend `{ ok: false, code: "VALIDATION_ERROR", details }` :
la route `api/orders/route.ts` lui passe le corps brut. Les deux formes sont admises ; ce qui ne
l'est pas, c'est d'analyser dans la route **et** dans le service. Une fabrique de route branchée
sur un tel service déclare `body: z.unknown()` (`api-route-conventions` § 1).

## 4. Stockage navigateur

- Modèle : `normalizeStoredCart(raw: unknown): CartState` (`src/lib/cart/stored-cart.ts`), appelé
  par `src/lib/hooks/use-cart.tsx` sur `JSON.parse(sessionStorage.getItem(…))`. Le parseur est pur
  et testé ; il répare les anciennes formes (poids manquant, prix de découpe), écarte une ligne
  irrécupérable, et rend `EMPTY_CART` pour le reste.
- Le `try/catch` autour de l'accès au stockage est légitime : le navigateur peut le refuser
  (navigation privée, données bloquées). Rendre l'état vide n'est admis que pour un confort propre
  à l'appareil, sans argent en jeu (le panier n'est qu'une estimation, le serveur refait le devis :
  `CLAUDE.md` « Système de panier »). Ce n'est pas un modèle pour une donnée serveur.
- Un parseur à la main (gardes `isRecord`, `isCents`) convient pour réparer ; pour une forme
  nouvelle, un schéma Zod plus court suffit.

## 5. Colonnes `Json` (lecture et écriture)

Prisma type une colonne `Json` en `Prisma.JsonValue` : chaîne, nombre, booléen, `null`, tableau ou
objet. Un `as Record<…>` affirme une forme que personne n'a vérifiée.

**Lecture : un parseur par colonne, chez son autorité.** Lever ou rendre `null` selon le coût
d'une valeur fausse :

| Colonne              | Parseur                                                  | Échec       | Pourquoi                                                              |
| -------------------- | -------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `Product.cutOptions` | `parseCutOptions` (`src/lib/pricing/unit-price.ts`)      | `TypeError` | un prix de découpe faux vendrait au mauvais prix : mieux vaut échouer |
| `Shop.openingHours`  | aucun aujourd'hui ; à créer dans `src/lib/shop-hours.ts` | `null`      | l'absence est un état affichable (« horaires non renseignés »)        |

```ts
// src/lib/shop-hours.ts (proposition) — forme stockée : Record<jour, { open, close } | null>
const dayHoursSchema = z.object({ open: z.string(), close: z.string() }).strict();
const openingHoursSchema = z.record(z.string(), dayHoursSchema.nullable());

/** openingHours as stored, or null when the column holds no readable week (string, array, bad shape). */
export function parseOpeningHours(raw: Prisma.JsonValue): OpeningHours | null {
  const parsed = openingHoursSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// appelant (service) : lit, analyse, signale une donnée illisible, puis passe par getDayHours
export function sundayHours(shop: { id: string; openingHours: Prisma.JsonValue }) {
  const hours = parseOpeningHours(shop.openingHours);
  if (hours === null && shop.openingHours !== null) {
    logger.warn("[shop-hours] openingHours illisible", { shopId: shop.id });
  }
  return getDayHours(hours, 0);
}
```

Les clés restent françaises (`lundi` … `dimanche`) et `getDayHours` accepte aussi `mon` … `sun` :
ne pas les réécrire. Le contenu des heures (`"HH:MM"`) est déjà contrôlé par `getShopStatus`
(`parseHHMM`) ; le schéma ne vérifie que la forme, il ne duplique pas cette règle.

**Écriture : une valeur typée, jamais une chaîne JSON.** `JSON.stringify({})` écrit la chaîne
`"{}"`, pas un objet vide (`src/app/api/shops/register/route.ts`, piège 3 du skill). Écrire
`openingHours: {}` ; pour un objet construit, le typer d'abord (`const week: OpeningHours = …`).

**Inventaire.** Le schéma compte une vingtaine de colonnes `Json` (`pickupSlots`, `sliceOptions`,
`itemsSnapshot`, `payloadJson`, `scopes`, `tiers`…) ; la plupart sont lues par `as`. Comptes et
commande : etat-du-code § 1. Une colonne se corrige quand un chantier la touche, avec son parseur
et un test unitaire (fonction pure, `CLAUDE.md` « Tests »).

## 6. Réponse d'une API externe, webhook

- `await res.json()` rend `any` : `(await res.json()) as { photos?: PexelsPhoto[] }`
  (`src/lib/image-search.ts`) est un cast, pas une analyse. Forme attendue :

```ts
const geocodeSchema = z.object({ lat: z.number().finite(), lng: z.number().finite() });

export async function readGeocode(res: Response) {
  const raw: unknown = await res.json();
  const parsed = geocodeSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Réponse de géocodage illisible", { cause: parsed.error });
  return parsed.data;
}
```

Le schéma ne décrit que les champs lus (pas de `.strict()` sur une réponse tierce, qui peut
gagner des champs). Délai et nouvelle tentative : `reliability-observability` § 5.

- Webhook : la signature se vérifie d'abord (`security-multitenant` § 6, `stripe-payment`) ; le
  corps vérifié reste d'une forme inconnue pour notre code, donc les champs lus passent par un
  schéma plutôt que par `as WebhookEvent` (`src/app/api/webhooks/clerk/route.ts` caste aujourd'hui).

## 7. Identifiants marqués : le pilote

Ce que fait une marque Zod v3 (`z.string().brand<"X">()`, vérifié dans le Zod installé) : un type
`string & BRAND<"X">`, sans aucun contrôle à l'exécution de plus que le schéma de base. Une valeur
marquée ne s'obtient que par analyse.

```ts
export const clerkUserIdSchema = z.string().min(1).brand<"ClerkUserId">();
export const dbUserIdSchema = z.string().min(1).brand<"DbUserId">();
export type ClerkUserId = z.infer<typeof clerkUserIdSchema>;
export type DbUserId = z.infer<typeof dbUserIdSchema>;

declare function ordersOf(userId: DbUserId): Promise<number>;
const clerkId = clerkUserIdSchema.parse(rawFromAuth);
await ordersOf(clerkId); // erreur de compilation
await ordersOf(someString); // erreur de compilation
```

Ce qui est vérifié (compilation d'essai) et ce qui ne l'est pas :

| Situation                                              | Résultat        |
| ------------------------------------------------------ | --------------- |
| `ClerkUserId` passé à un paramètre `DbUserId`          | refusé          |
| `string` brut passé à un paramètre `DbUserId`          | refusé          |
| `clerkId === dbUserId`, deux marques différentes       | refusé (TS2367) |
| `order.userId === clerkId` (colonne Prisma = `string`) | **accepté**     |
| `where: { userId: clerkId }` dans une requête Prisma   | **accepté**     |

La protection vaut donc aux signatures de service, pas dans les requêtes Prisma. Pilote proposé :

1. Un module : les commandes client de `src/lib/services/orders/commands/`
   (`cancelOrderByCustomer`, `rateOrder`…). Depuis C1-INVITES, les routes `api/orders/[id]/cancel`,
   `choose-alternatives` et `adjustment/*` obtiennent le `userId` par `authorizeOrderAccess`
   (`access.customerId`, `src/lib/auth/order-access.ts`) ; `rate` passe encore par
   `customerUserId`.
2. Les deux producteurs rendent un `DbUserId` (analyse de `user.id` ou de `orders.user_id`), et le
   champ `userId` des entrées de ces commandes devient `DbUserId`. `order-access.ts` est un fichier
   d'auth : le toucher relève de `security-multitenant` et du brief.
3. Pas de préfixe dans le schéma : les utilisateurs du mode test (`test-client-001`,
   `src/lib/auth/test-auth.ts`) et du seed (`boucher_…`) n'ont pas le préfixe `user_` de Clerk.
4. Placement du schéma partagé : `src/lib/validators/` (`architecture-conventions` § 2).
5. Mesure de réussite : `npx tsc --noEmit` vert, tests d'intégration des commandes client verts,
   et un test de type (`// @ts-expect-error` dans un fichier de test) qui prouve le refus.

Étendre au-delà du module, ou introduire un `AuthorizedShopId` que seuls les helpers d'auth
produisent (Rallly fait ainsi pour son tenant), est un point à arbitrer du skill.

## 8. Variables d'environnement

- `process.env` est lu directement dans plusieurs dizaines de fichiers (etat-du-code § 1) ; un
  module d'environnement validé au démarrage est une décision de `quality-gates` et du propriétaire.
- En attendant : lire une variable dans un seul module, tester sa présence là où elle compte,
  jamais `process.env.X!`, jamais une valeur par défaut qui cache une absence en production
  (`reliability-observability` § 2, dernière ligne). Les `NEXT_PUBLIC_*` sont figées au build et ne
  portent jamais de secret (`CLAUDE.md` « Variables d'environnement »).
