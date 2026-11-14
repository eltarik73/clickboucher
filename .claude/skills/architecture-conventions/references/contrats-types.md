# Contrats typés : serveur, client, base

Le code de cette page a été compilé avec `tsc` (TypeScript 5.9.3, `strict`) contre l'arbre du
2026-11-14 [L7]. Les fichiers proposés (`src/lib/api/json.ts`) n'existent pas encore. Le chantier
prix modifie encore `src/lib/services/orders/` : vérifier qu'un export cité existe toujours.

## 1. D'où vient un type

| Donnée | Source unique du type | Exemple existant |
| --- | --- | --- |
| Entrée d'une route | schéma Zod, `z.infer<typeof schema>` [S10] | `OrderQuoteRequest` (`validators/order.ts`) |
| Ligne lue en base | objet `select` / `include` `as const` (+ `satisfies Prisma.XSelect`), puis `Prisma.XGetPayload<…>` [S8] | `OrderRow` (`order-read.ts`), `CustomerOrder` (`customer-view.ts`) |
| Réponse d'un service | interface exportée par le service | `OrderQuote` (`quote.ts`), `KitchenBoard` (`kitchen.ts`) |
| Réponse JSON vue par le client | `Serialized<type du service>` (§ 2) | à créer |
| Résultat métier | union discriminée exportée par le service [S7] | `CommandResult<T>` (`commands/outcome.ts`) |

Règles :
- Un type de domaine n'est **jamais** réécrit à la main dans une page : il est importé (`import type`)
  ou dérivé. Prisma note qu'un type partiel écrit à la main alourdit la maintenance à chaque
  changement du schéma [S8].
- Un fichier client importe d'un module serveur **uniquement des types** : `import type` est effacé
  à la compilation et n'embarque ni Prisma ni secret. Un import de valeur depuis `lib/services`,
  `lib/prisma` ou un helper d'auth dans un fichier `"use client"` est interdit (0 aujourd'hui).
- La projection (`select`) est aussi la frontière de sécurité : ce qui n'y est pas ne sort pas
  (`public-projections.ts`, `customer-view.ts` : listes blanches ; voir `security-multitenant`).
  Cal.com en fait une règle (« DTO à chaque frontière ») [S5].
- Une vue par audience : le client lit `CustomerOrder`, la boutique lit `OrderRow`. Ne pas réutiliser
  la ligne de la boutique pour un écran client.

Variante de la doc Prisma [S8] : `const args = { select: { … } } satisfies Prisma.UserDefaultArgs` puis
`Prisma.UserGetPayload<typeof args>`. La nôtre (`satisfies Prisma.XSelect` sur l'objet `select`,
`GetPayload<{ select: typeof x }>`) compile avec Prisma 6.19.2 [L7] ; garder celle du dépôt.

## 2. `Serialized<T>` : ce que le client reçoit vraiment

`NextResponse.json` passe par `JSON.stringify` : un `Date` devient une chaîne ISO, une propriété
`undefined` ou une fonction disparaît. `KitchenRow.createdAt` est un `Date` côté serveur et une
`string` côté client — d'où le `KitchenOrder` recopié à la main dans `hooks/use-order-polling.ts`.

Deux types Prisma ne sont pas du JSON dans ce schéma :
- `DateTime` → `Date` → chaîne ISO ;
- `BigInt` : une seule colonne, `Shop.monthlyGmvCents`. `JSON.stringify` lève sur un `bigint` ;
  `src/lib/api/errors.ts` installe `BigInt.prototype.toJSON` qui renvoie un `number`. Le client
  reçoit donc un nombre — à condition que ce module soit chargé, ce qui est le cas de toute route
  qui répond par `apiSuccess` / `apiError`.

Aucune colonne `Decimal` ni `Bytes` (vérifié dans `prisma/schema.prisma`).

```ts
// src/lib/api/json.ts (proposé) — types seulement, importable partout.
/** Ce que JSON.stringify fait de T ici : Date -> string (ISO), bigint -> number, fonctions retirées. */
export type Serialized<T> = T extends Date
  ? string
  : T extends bigint
    ? number
    : T extends readonly (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: Serialized<T[K]> }
        : T;
```

Usage côté client :

```ts
import type { KitchenBoard } from "@/lib/services/orders/kitchen";
import type { Serialized } from "@/lib/api/json";

type KitchenBoardJson = Serialized<KitchenBoard>;
// board.active[0].createdAt: string ; .totalCents: number ; .shop.name: string ;
// .pickupSlotStart: string | null — vérifié par @ts-expect-error sur `const d: Date = …createdAt`.
// Serialized<Shop>["monthlyGmvCents"]: number ; ["openingHours"] reste du JSON non typé (à parser, § 3).
```

Limites :
- Le type décrit la forme, il ne vérifie rien à l'exécution. Il n'est juste que si la route renvoie
  l'objet du service **tel quel** (`apiSuccess(board)`) ; si elle le transforme, c'est la fonction de
  transformation qui exporte le type.
- L'enveloppe `{ success, data }` de `apiSuccess` est décrite dans `api-route-conventions` ; un
  client lit `body.data` puis le type ci-dessus.
- Pour une réponse issue d'un service tiers ou d'une colonne `Json`, valider (§ 3).

Migration de `KitchenOrder` : remplacer le type écrit à la main par
`Serialized<KitchenBoard>["active"][number]` dans une PR dédiée ; `tsc` fera apparaître chaque champ
que le hook croyait présent et que le service ne renvoie pas (ou l'inverse).

## 3. Colonnes `Json`

Le schéma en compte 20 (`openingHours`, `pickupSlots`, `cutOptions`, `sliceOptions`, `itemsSnapshot`,
`notifSent`, `scopes`, `tiers`, …). Prisma les type `JsonValue` : n'importe quoi.

- **Un parseur par colonne**, au plus près de la lecture, qui renvoie un type sûr ou échoue
  explicitement. Modèle : `parseCutOptions(raw: unknown)` (`pricing/unit-price.ts`, lève `TypeError`
  sur une forme invalide).
- `getDayHours` (`shop-hours.ts`) est le **lecteur unique** d'`openingHours` (clés FR et EN, `null`
  si fermé), mais il attend un `OpeningHours` déjà typé : ses appelants écrivent encore
  `s.openingHours as OpeningHours | null`. Il ne valide pas la forme ; ne pas le citer comme parseur.
- Avec Zod : `const parsed = schema.safeParse(row.colonne)` puis `parsed.success ? parsed.data : …` —
  `safeParse` ne lève pas et renvoie une union discriminée [S10]. Modèles dans le dépôt :
  `acceptedPayloadSchema.safeParse(…payloadJson)` (`services/orders/stock-hold.ts`),
  `snapshotSchema.safeParse(adjustment.itemsSnapshot)` (`adjustment-settlement.ts`).
- Interdit : un `as Record<string, …>` à chaque lecture (32 casts `as Record<string` dans `src/`
  aujourd'hui), `as unknown as` (5 hors tests).
- Écriture : le même schéma valide avant `prisma.x.update` (règle `CLAUDE.md` « Zod côté serveur »).
- `cutOptions` a aujourd'hui deux définitions (`cutOptionSchema` Zod dans `validators/index.ts`,
  `parseCutOptions` manuel) : ne pas en créer une troisième ; unifier quand on touche l'une.

## 4. Résultats de service

Deux formes coexistent, toutes deux acceptables ; garder celle du domaine que l'on modifie :

```ts
// commandes de statut — commands/outcome.ts
type CommandResult<T> =
  | { kind: "done"; data: T } | { kind: "replay"; data: T } | { kind: "not_found" }
  | { kind: "conflict"; currentStatus: OrderStatus }
  | { kind: "refused"; code: CommandRefusalCode; message: string; details?: Record<string, string[]> };

// création, devis, liste — create.ts, list.ts
type ListOrdersResult =
  | { ok: true; orders: OrderRow[] }
  | { ok: false; code: "VALIDATION_ERROR"; message: string };
```

La traduction HTTP d'une commande est **une** fonction (`transitionResponse`, `commands/http.ts`) :
seul fichier de `lib/services` qui fabrique une réponse, par `apiSuccess` / `apiError`.

**Exhaustivité** [S7][L7]. `tsconfig.json` n'active pas `noImplicitReturns` : un `switch` sur
`result.kind` auquel il manque un cas compile sans erreur si la fonction n'a pas de type de retour
déclaré (elle renvoie alors `undefined` pour ce cas). Deux façons de forcer le compilateur, à
employer pour tout nouveau `switch` sur une union :
- déclarer le type de retour (`: Promise<CommandResult<object>>`, modèle `runAction` dans
  `api/boucher/orders/[orderId]/action/route.ts`) → erreur TS2366 si un cas manque ;
- ou terminer par un `default` affecté à `never` (modèle `serviceFeeCentsFor`, `pricing/totals.ts`) :

```ts
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
// … default: return assertNever(result);   // erreur de compilation si un cas est oublié
```

`transitionResponse` n'a aujourd'hui ni l'un ni l'autre : lui donner un type de retour ou un
`default` quand on ajoute un `kind`.

Forme cible de `listOrders` (sans `NextRequest`, sans auth ; extrait compilé, filtre `status` et
règlement des ajustements échus omis car en mouvement dans le chantier prix) :

```ts
export type OrderListViewer =
  | { role: "ADMIN" }
  | { role: "BOUCHER"; shopIds: readonly string[] }
  | { role: "CLIENT"; userId: string };

export async function listOrders(viewer: OrderListViewer, query: OrderListQuery): Promise<ListOrdersResult> {
  const where: Prisma.OrderWhereInput = {};
  switch (viewer.role) {
    case "ADMIN":
      if (query.shopId) where.shopId = query.shopId;
      break;
    case "BOUCHER":
      where.shopId = query.shopId && viewer.shopIds.includes(query.shopId) ? query.shopId : { in: [...viewer.shopIds] };
      break;
    case "CLIENT":
      where.userId = viewer.userId;
      break;
  }
  const orders = await prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" }, take: 50 });
  return { ok: true, orders };
}
```

(`OrderListQuery = z.infer<typeof orderListQuerySchema>`. Un client lira `CustomerOrder` par
`listCustomerOrders`, pas `orderInclude` : garder la vue par audience du fichier au moment où on le
touche.) La route `GET /api/orders` résout `viewer` (rôle en base, boutiques possédées avec la clause
OR de `CLAUDE.md`), parse la query, appelle `listOrders`, traduit. Le test d'intégration appelle
`listOrders` directement avec trois `viewer`, sans simuler Clerk.

## 5. Services : signature

- Entrée : un objet nommé (`{ orderId, shopId, actorId, now }`), pas de positionnels au-delà de 2-3.
- Identité : déjà résolue et typée (`shopId`, `userId` Prisma). La conversion `clerkId` → `User.id`
  se fait dans la route, par `customerUserId(clerkId)` (exporté par `commands/outcome.ts`) ;
  `getAuthenticatedBoucher()` renvoie déjà `{ userId: User.id, shopId }`.
- Heure : `now: Date` en paramètre (modèles : commandes, `acceptAdjustment({ orderId, userId, now })`).
- Transaction : le service ouvre `prisma.$transaction` ; une fonction `…InTx(tx, …)` existe quand un
  autre service doit l'appeler dans sa propre transaction (`transitionOrderInTx`).
- Effets externes (e-mail, push) : après commit, jamais dans la transaction (`transition.ts`).
