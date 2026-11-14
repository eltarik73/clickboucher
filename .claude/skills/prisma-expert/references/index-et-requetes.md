# Index et requêtes

`[L…]` : `verifications-locales.md` (les extraits TypeScript de cette page ont été compilés [L31]). `[PR…]`, `[PG…]`, `[E…]` : `sources.md`.

## Sommaire

1. Règles d'index
2. Nos requêtes réelles et leur index
3. Lire moins : `select`, `omit`, `include`
4. Requêtes en boucle et lectures non bornées
5. Pagination
6. Agrégats et SQL brut
7. Lire un plan d'exécution

## 1. Règles d'index

- **Le tenant en tête.** Presque toute requête métier filtre par `shopId` (ou `userId`) : l'index commence par cette colonne, puis les autres égalités, puis **une** colonne d'inégalité ou de tri [PG5]. `@@index([shopId, createdAt])` sert « commandes de la boutique, les plus récentes d'abord » ; `@@index([createdAt, shopId])` ne le sert pas.
- **Toute clé étrangère est la première colonne d'un index** (simple, composé ou unique). PostgreSQL ne le fait pas seul, et chaque suppression du parent parcourt sinon la table fille [PG7] : 45,5 ms contre 2,8 ms pour un produit [L30].
- **Pas de doublon** : pas d'`@@index` sur une colonne déjà `@unique`, ni sur le préfixe exact d'un autre index [PG13]. Un index coûte à chaque écriture : `orders` en porte 17, soit 85 Mo pour 44 Mo de données sur le jeu de volume [L30].
- **Trois colonnes au plus**, sauf plan mesuré qui prouve le contraire [PG5].
- **Un index naît d'une requête et d'un plan**, pas d'une intuition : écrire la requête, la mesurer sur la base de volume (§ 7), ajouter l'index, mesurer de nouveau.
- **Tout index créé en SQL est déclaré dans `schema.prisma`**, sinon Prisma le supprime à la première comparaison avec une base [L2]. Exceptions que Prisma ne voit pas et ne touche pas : index partiels et d'expression [L5] (réserves dans `migrations.md` § 4).
- Création et retrait sur une table existante : `CONCURRENTLY`, seul dans son fichier (`migrations.md` § 4). Retrait : seulement après lecture de `pg_stat_user_indexes` en production.

`node .claude/skills/prisma-expert/scripts/schema-audit.mjs --strict` échoue s'il reste une clé étrangère sans index ou un index redondant ; il en reste aujourd'hui (D3, D4 de `etat-du-code.md`), à traiter par des migrations dédiées, pas au détour d'un autre changement.

## 2. Nos requêtes réelles et leur index

Mesures sur 300 000 commandes [L28].

| Requête | Où | Index | Durée |
|---|---|---|---|
| Commandes d'une boutique, récentes d'abord | liste boucher de `services/orders/list.ts` | `Order [shopId, createdAt]` | 0,13 ms |
| Commandes actives d'une boutique | tableau cuisine (`services/orders/kitchen.ts`), auto-busy | `Order [shopId, status]` | 0,08 ms |
| `max(updatedAt)` d'une boutique | **pas encore dans le code** : sonde de version prévue par `order-lifecycle-realtime`. Aujourd'hui l'index sert l'historique cuisine de `kitchen.ts` (`updatedAt >= …`, tri `updatedAt desc`) | `Order [shopId, updatedAt]`, index seul | 0,11 ms |
| Occupation d'un créneau | `services/orders/shop-capacity.ts`, `api/shops/[id]/available-slots` | `Order [shopId, pickupSlotStart]` | 0,07 ms |
| Commandes expirées à annuler | `cron/auto-cancel` | `Order [status, expiresAt]` | 0,04 ms |
| Commandes d'un client | suivi client | `Order [userId, status]` puis tri | 0,35 ms |
| Chiffre du mois d'une boutique | `boucher/finances` | `orders(shop_id, paid_at)` — **SQL seul**, absent du schéma | 0,56 ms (5,2 ms sans) |
| Recherche produit `contains`, insensible à la casse | `boucher/products`, recherche | GIN trigramme `idx_products_name_trgm` — **SQL seul** | 0,8 ms (10,0 ms sans) |
| Commande retrouvée par `stripePaymentIntentId` | `payments/webhook` | `orders(stripe_payment_intent_id)` — **SQL seul** (ainsi que celui sur `stripe_checkout_session_id`, colonne seulement écrite aujourd'hui) | non mesuré |
| Lignes d'un panier par `cartId` | `api/cart` | **aucun** (D3) | non mesuré |

À ajouter au schéma dès la prochaine migration qui touche `Order` (aucun SQL à produire si la base les porte déjà, ce qu'il faut vérifier) : `@@index([shopId, paidAt])`, `@@index([stripePaymentIntentId])`, `@@index([stripeCheckoutSessionId])` [L3].

## 3. Lire moins : `select`, `omit`, `include`

- `include` charge **toutes** les colonnes du modèle et lance **une requête par relation**, sans jointure [L13]. Trois niveaux d'`include` = quatre allers-retours, l'un après l'autre.
- `relationLoadStrategy: "join"` n'est pas disponible : préversion non activée, le compilateur le refuse [PR18][L31]. Ne pas activer de préversion dans le cadre d'un chantier.
- Réponse d'API : `select` explicite (règle de `security-multitenant`). `omit` existe dans notre client et convient pour exclure deux ou trois champs sensibles d'un gros modèle :

```ts
prisma.shop.findUnique({ where: { slug }, omit: { ownerId: true, stripeAccountId: true, siret: true } });
```

- Compter une relation : `select: { _count: { select: { items: true } } }`, pas un `include` suivi de `.length` [PR18].
- Objet d'un tenant : `findFirst({ where: { id, shopId } })`, pas `findUnique({ where: { id } })` suivi d'un `if`.
- **`undefined` dans un `where` supprime le filtre** : `where: { shopId: undefined }` rend toute la table [L16]. Valider la valeur avant d'écrire la requête ; ne jamais passer un `shopId` optionnel.

## 4. Requêtes en boucle et lectures non bornées

Une requête par tour de boucle multiplie les allers-retours ; seuls des `findUnique` lancés dans le même tick sont regroupés par le client [PR5]. Remplacements :

| Boucle | Remplacement |
|---|---|
| Lire un enfant par parent | `where: { parentId: { in: ids } }` puis regroupement en mémoire (`Map`) |
| Agréger par parent | `groupBy` (une requête pour toutes les boutiques : 24 ms [L28j]) |
| Écrire la même valeur sur N lignes | `updateMany({ where: { id: { in: ids }, shopId } })` |
| Créer N lignes | `createMany` (`skipDuplicates` si la clé unique arbitre) |
| Écrire N valeurs différentes | regrouper par valeur ; à défaut `$transaction([...])` par paquets bornés |

```ts
// Chiffre d'un mois pour toutes les boutiques — remplace l'aggregate par boutique de cron/recalc-shop-tiers
const rows = await prisma.order.groupBy({
  by: ["shopId"],
  where: { paidAt: { gte: from, lt: to } },
  _sum: { totalCents: true },
});
const gmvByShop = new Map(rows.map((row) => [row.shopId, row._sum.totalCents ?? 0]));
```

**Tout `findMany` porte un `take`**, ou une liste `in:` dont la taille est bornée par construction. Un cron ou un export qui doit tout parcourir avance par lots, sur la clé :

```ts
let after: string | undefined;
for (;;) {
  const batch = await prisma.shop.findMany({
    where: after ? { id: { gt: after } } : {},
    orderBy: { id: "asc" },
    take: 200,
    select: { id: true },
  });
  if (batch.length === 0) break;
  await handle(batch.map((shop) => shop.id)); // UNE requête par lot (groupBy, updateMany), pas une par ligne
  after = batch[batch.length - 1].id;
}
```

Cliquet à faire respecter en revue : `node .claude/skills/prisma-expert/scripts/query-audit.mjs --max-unbounded=62 --quiet` échoue si le nombre de `findMany` sans `take` augmente ; baisser le nombre à chaque correction. Le script signale aussi les boucles et les `skip` : un constat est une invitation à lire le code, pas une preuve.

## 5. Pagination

Le contrat HTTP (`page` / `perPage` ou `cursor` / `limit`, `nextCursor`) est celui d'`api-route-conventions`. Ce qui suit concerne la requête.

| Liste | Technique | Raison |
|---|---|---|
| Petite et bornée par nature (catégories, membres, offres d'une boutique) | `take` de sécurité, pas de pagination | — |
| Tableau de back-office avec numéros de page, quelques milliers de lignes au plus après filtre | `skip` / `take` + `count`, tri départagé par `id` | Usage prévu par Prisma [PR6] ; coût proportionnel à la profondeur [PG6] |
| Liste qui grandit sans borne (commandes, notifications, journaux, avis) ou parcourue en profondeur | **par clé** `(createdAt, id)`, patron ci-dessous | 0,10 ms à toute profondeur [L29] |
| Export, cron | parcours par lots sur la clé (§ 4) | — |

Mesures [L28g][L29] : page à 200 000 lignes de profondeur sur toute la table, 50,7 ms en `skip` contre 0,11 ms par clé. À 4 500 lignes de profondeur dans une boutique : `skip` 6,9 ms ; curseur natif de Prisma (`cursor: { id }, skip: 1`) avec tri sur deux colonnes 2,8 ms, parce qu'il **filtre** les 4 500 lignes précédentes au lieu de s'y rendre ; par clé avec borne 0,10 ms. Shopify mesure le même écart à grande échelle [E2].

```ts
type OrderCursor = { createdAt: Date; id: string };

export async function listShopOrders(shopId: string, limit: number, cursor?: OrderCursor) {
  const where: Prisma.OrderWhereInput = {
    shopId,
    ...(cursor && {
      createdAt: { lte: cursor.createdAt },                                    // borne lue dans l'index [shopId, createdAt]
      OR: [{ createdAt: { lt: cursor.createdAt } }, { id: { lt: cursor.id } }], // départage des ex æquo
    }),
  };
  const rows = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, // une ligne de plus pour savoir s'il y a une suite
    select: { id: true, createdAt: true, status: true, totalCents: true, displayNumber: true },
  });
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null };
}
```

- Le tri est **toujours** départagé par `id` : sans ordre unique, `LIMIT` rend un sous-ensemble imprévisible et des lignes sautent ou se répètent entre deux pages [PG6].
- Sans la ligne `createdAt: { lte }`, le résultat est identique mais le plan relit tout ce qui précède le curseur [L29].
- Le curseur natif de Prisma reste acceptable quand le tri porte sur **une seule** colonne unique, ou quand le tenant ne dépassera jamais quelques milliers de lignes.
- Pas de `count` de tout l'ensemble à chaque page d'une liste qui grandit (12 ms pour 300 000 lignes, sur l'unique connexion [L28h]) : `nextCursor` suffit ; un total, s'il est demandé, se calcule une fois ou se plafonne.
- Limite de la technique : pas de saut à une page arbitraire [E7].

## 6. Agrégats et SQL brut

- `aggregate` et `groupBy` rendent des `number` pour un champ `Int` [L15] ; les préférer au chargement de lignes additionnées en JavaScript (D5).
- Regrouper **par jour** exige du SQL : le jour est celui de Paris, la colonne un instant UTC (`schema-et-types.md` § 3).

```ts
const rows = await prisma.$queryRaw<{ day: string; orders: number; revenueCents: number }[]>`
  SELECT to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day,
         count(*)::int AS orders,
         coalesce(sum(total_cents), 0)::int AS "revenueCents"
  FROM orders
  WHERE shop_id = ${shopId}
    AND created_at >= (${from}::timestamptz AT TIME ZONE 'UTC')
    AND created_at <  (${to}::timestamptz AT TIME ZONE 'UTC')
    AND status IN ('COMPLETED', 'PICKED_UP')
  GROUP BY 1
  ORDER BY 1`;
```

`from` et `to` sont des `Date` : les bornes d'un jour de Paris se calculent avec `parisWallClockToUtc()` de `src/lib/paris-time.ts`.

Règles du SQL brut :

1. Gabarit étiqueté uniquement (`$queryRaw\`…\``, `$executeRaw\`…\``) : les valeurs partent en paramètres [PR21]. Jamais `$queryRawUnsafe` ni chaîne concaténée ; une liste passe par `Prisma.join`, un fragment par `Prisma.sql`. Aucun identifiant (table, colonne, ordre de tri) ne vient de l'entrée.
2. Le tenant est dans le `WHERE`, comme partout.
3. Noms SQL réels : tables et colonnes en snake_case (`orders.shop_id`), pas les noms de champs Prisma.
4. `count(*)` et `sum(entier)` reviennent en `bigint` : ajouter `::int` (ou convertir) avant de sérialiser, sinon `JSON.stringify` échoue [L15]. `::int` déborde au-delà de 2 147 483 647 [PG10] : pour un cumul de centimes sur toute la plateforme, garder `bigint` et convertir explicitement.
5. Dates. Bornes demi-ouvertes (`>= début AND < fin`), jamais `BETWEEN` [PG14]. Une `Date` passée en paramètre d'un SQL brut est comparée selon le **fuseau de la session** PostgreSQL : en session `Europe/Paris`, la fenêtre se décale et la ligne n'est plus trouvée, alors que les requêtes de modèle Prisma ne dépendent pas de ce fuseau [L37]. Écrire `(${date}::timestamptz AT TIME ZONE 'UTC')` pour une borne et `now() AT TIME ZONE 'UTC'` pour un horodatage écrit : les deux formes sont justes quel que soit le fuseau de session [L37].
6. Une fonction SQL qui rend `void` (`pg_advisory_xact_lock`) s'appelle par `$executeRaw` : `$queryRaw` échoue en `P2010` [L18].
7. Une écriture en SQL brut ne renseigne pas `updated_at` : l'écrire soi-même (`updated_at = now() AT TIME ZONE 'UTC'`) [L4].

## 7. Lire un plan d'exécution

Sur la base jetable (`verifications-locales.md`, « Refaire une vérification »), chargée d'un volume réaliste : `EXPLAIN (ANALYZE, BUFFERS) <requête>`.

- `Index Cond` = ce que l'index borne ; `Filter` + `Rows Removed by Filter` = ce qui est lu puis jeté. Un grand « removed » dit que l'index ne correspond pas à la requête.
- `Seq Scan` sur une grande table pour une requête sélective = index manquant ou inutilisable.
- `Buffers` (blocs lus) se compare mieux que la durée entre deux écritures de la même requête.
- Le planificateur choisit selon les statistiques : sur une table vide ou minuscule il préférera toujours le parcours séquentiel. Ne rien conclure sans volume.
