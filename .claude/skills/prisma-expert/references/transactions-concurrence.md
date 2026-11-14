# Transactions et concurrence

`[L…]` : `verifications-locales.md` (les extraits TypeScript de cette page ont été compilés [L31]). `[PR…]`, `[PG…]`, `[PGB…]` : `sources.md`. Le changement de **statut** d'une commande a son propre patron dans le skill `order-lifecycle-realtime` ; cette page traite du reste.

## Sommaire

1. Ce que garantit la base par défaut
2. Choisir l'outil
3. Écriture conditionnelle : réclamer, plafonner
4. Compteurs et numéros
5. Invariant sur plusieurs lignes : verrou de transaction
6. Règles d'une transaction interactive
7. Rejouer
8. Journal dans une colonne JSON
9. Erreurs à reconnaître

## 1. Ce que garantit la base par défaut

Niveau `READ COMMITTED` [PG1][PR1] : chaque instruction voit ce qui est validé au moment où elle démarre. Deux requêtes qui lisent puis écrivent peuvent donc lire le même état. En revanche un `UPDATE` qui tombe sur une ligne en cours de modification **attend**, puis **ré-évalue son `WHERE`** sur la nouvelle version [PG1]. Toute la technique de cette page tient en une phrase : mettre la condition dans l'instruction qui écrit, pas dans une lecture qui la précède.

Ce qui ne protège de rien : un `findFirst` de contrôle avant un `create` ou un `update` ; un `count` avant un `create` ; une transaction qui enveloppe ce même enchaînement sans verrou (20 commandes sur un créneau de 5, avec ou sans transaction [L17]).

Une lecture de contrôle redevient fiable quand la transaction a **d'abord** pris un verrou que tous les concurrents prennent aussi : une ligne parente qu'elle vient d'écrire (verrou de ligne tenu jusqu'au `COMMIT`), ou un verrou consultatif (§ 5). C'est ce que fait `consumeOffer` : l'incrément gardé verrouille la ligne de l'offre, puis le `findFirst` « ce client a-t-il déjà utilisé l'offre ? » voit toutes les commandes concurrentes déjà validées.

## 2. Choisir l'outil

| Situation | Outil | Exemple chez nous |
|---|---|---|
| « Une seule fois », « seulement si encore libre » | `updateMany` gardé + `count` (§ 3) | récompense fidélité, compte Stripe d'une boutique |
| Plafond porté par la ligne elle-même | `updateMany` gardé par référence de champ (§ 3) | `Offer.currentUses` contre `maxUses` |
| Unicité | contrainte `@unique` / `@@unique`, et traiter `P2002` comme « déjà fait » | `idempotencyKey`, `StripeEvent.id`, `ShopCustomer` |
| Numéro suivant | `INSERT … ON CONFLICT DO UPDATE … RETURNING` (ou `upsert` avec `increment`), dans la transaction de l'écriture (§ 4) | `DailyCounter`, `OrderNumberCounter`, `CustomerCounter` via `numbering.ts` |
| Compteur ou moyenne dérivés | `increment` atomique, ou recalcul par `aggregate` dans la même transaction ; jamais « valeur lue + 1 » | `Shop.rating` / `ratingCount` |
| Invariant qui dépend d'**autres lignes** | verrou consultatif de transaction, puis compter et écrire (§ 5) | capacité d'un créneau, commandes par heure |
| Plusieurs écritures qui doivent réussir ensemble | `$transaction` interactive (§ 6) | commande + lignes + coupon + numéros |
| Écritures indépendantes sans lecture intermédiaire | `$transaction([...])` (tableau) | suppression de compte |

`Serializable` n'est pas l'outil par défaut : il fonctionne, mais 17 transactions sur 20 échouent en `P2034` et doivent être rejouées [L17], sur une connexion unique.

## 3. Écriture conditionnelle : réclamer, plafonner

Pour une offre ou une récompense de fidélité, **appeler** `consumeOffer`, `consumeLoyaltyReward` et `releaseOrderDiscount` de `src/lib/services/orders/discount-ledger.ts` ; pour le stock anti-gaspi et vente flash, `reserveLimitedStock` / `releaseLimitedStock` de `limited-stock.ts`. Ne pas les réécrire. La forme à imiter pour un nouveau cas :

```ts
// Abrégé de consumeOffer et consumeLoyaltyReward (le code réel garde aussi startDate / endDate)
if (offerId) {
  const { count } = await tx.offer.updateMany({
    where: {
      id: offerId,
      status: "ACTIVE",
      OR: [{ maxUses: null }, { currentUses: { lt: tx.offer.fields.maxUses } }], // compare deux colonnes
    },
    data: { currentUses: { increment: 1 } },
  });
  if (count === 0) throw new DiscountUnavailableError("OFFER_NOT_REDEEMABLE"); // annule toute la transaction
}
if (rewardId) {
  const { count } = await tx.loyaltyReward.updateMany({
    where: { id: rewardId, userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now, usedOnOrderId: orderId },
  });
  if (count === 0) throw new DiscountUnavailableError("REWARD_UNAVAILABLE");
}
```

Mesuré : plafond de 3 respecté sous 10 consommations simultanées (10 avec l'ancien incrément inconditionnel) [L19] ; une seule réclamation gagnante sur 10 [L20]. C'est le contrôle optimiste que documente Prisma, la condition métier tenant lieu de colonne `version` [PR1].

- `count === 0` signifie « quelqu'un d'autre est passé, ou la ligne n'existe pas » : relire pour distinguer, répondre 409 ou 404 (`api-route-conventions`).
- Le périmètre (`shopId`, `userId`) fait partie de la garde.
- Ne pas passer `limit` à `updateMany` sur une écriture gardée : Prisma émet alors `WHERE id IN (SELECT … LIMIT n)` [L41] et la condition n'est plus ré-évaluée après l'attente du verrou (voir `order-lifecycle-realtime`).
- Variante « écrire puis vérifier » (`limited-stock.ts`) : décrémenter sans condition sur la valeur, relire la ligne **dans la même transaction** (elle est verrouillée par l'écriture), lever une exception si le compteur est passé sous 0 ; l'annulation de la transaction rend les unités. Trier les lignes par identifiant avant d'écrire, pour que deux transactions verrouillent dans le même ordre [PG2].
- Une `CHECK (current_uses <= max_uses)` en base est un filet possible, mais Prisma ne la voit pas [L5] et les bases de test ne l'auront pas : la garde reste dans la requête.

Édition « lire, modifier, enregistrer » d'un formulaire (fiche produit, réglages boutique) : renvoyer au client la valeur `updatedAt` lue et l'exiger à l'écriture, `prisma.product.updateMany({ where: { id, shopId, updatedAt: lu }, data })` ; `count === 0` = modifié entre-temps (ou absent), répondre 409. Une seule écriture gagne sur trois simultanées [L39] ; Prisma cite l'horodatage comme jeton possible [PR1]. Limites : le jeton a la précision de la milliseconde et une écriture en SQL brut ne le change que si elle pose `updated_at` — suffisant pour un formulaire rempli par un humain, pas pour une garde entre deux processus automatiques (là, condition métier dans le `WHERE` ou colonne `version` incrémentée).

## 4. Compteurs et numéros

**Numéros d'une commande : ils existent, les appeler.** `src/lib/services/orders/numbering.ts` expose `allocateCustomerNumber(tx, shopId, userId)`, `allocateDailyNumber(tx, shopId, now)` et `allocateOrderNumber(tx, now)`, appelés dans cet ordre par `create.ts` juste avant `tx.order.create`. Chacun écrit `INSERT … ON CONFLICT … DO UPDATE … RETURNING` par `tx.$queryRaw` (en SQL brut, fournir l'`id` et le jour de Paris : `${dateKey}::date`).

**Nouveau compteur** : même forme SQL, ou son équivalent Prisma ci-dessous. Un `upsert` avec `increment` sur une clé unique part en **une** instruction `INSERT … ON CONFLICT DO UPDATE` : 20 appels simultanés rendent 20 numéros distincts [L12]. Conditions pour que Prisma émette cette forme [PR14] : un seul modèle, pas d'écriture imbriquée, pas de relation dans `select` / `include`, un seul critère unique dans `where` (une clé composée compte pour un), la même valeur de clé dans `where` et dans `create`, `update` non vide. Hors de ces conditions, Prisma lit puis écrit (`SELECT` puis `UPDATE` ou `INSERT`) : ajouter `include: { shop: true }` suffit à perdre l'atomicité [L41] ; relire le SQL émis en cas de doute.

```ts
export function parisDateOnly(now: Date = new Date()): Date {
  const { year, month, day } = getParisWallClock(now); // src/lib/paris-time.ts
  return new Date(Date.UTC(year, month - 1, day));      // valeur attendue par une colonne @db.Date
}

export async function nextNumbers(tx: Prisma.TransactionClient, shopId: string, now: Date) {
  const date = parisDateOnly(now);
  const { year } = getParisWallClock(now);
  const daily = await tx.dailyCounter.upsert({
    where: { shopId_date: { shopId, date } },
    create: { shopId, date, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const yearly = await tx.orderNumberCounter.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return { dailyNumber: daily.lastNumber, sequence: yearly.lastNumber, year };
}
```

- **Dans la transaction qui crée la ligne numérotée** (`tx`, pas `prisma`) : pris avant, le numéro est consommé même si la création échoue (ancien D21, corrigé par le chantier 0). Pris dedans, un échec l'annule ; il peut rester des trous en cas de reprise, ce que le schéma assume (« pas forcément sans trou »).
- L'`upsert` verrouille la ligne du compteur jusqu'au `COMMIT` : toutes les commandes qui partagent ce compteur se suivent une à une. `OrderNumberCounter` (une ligne par an) met en file **toutes** les créations de commande de la plateforme : garder la transaction courte et y placer les compteurs **en dernier**, juste avant le `create`.
- Prendre les compteurs **toujours dans le même ordre** dans tout le code (interblocage sinon [PG2]) : celui de `create.ts` est offre, client, jour, année.
- Jamais « plus grand numéro + 1 » ni « nombre de lignes + 1 » (ce que faisait `order-number.service.ts`, supprimé par le chantier 0).
- Le jour d'un compteur est celui de Paris : `setHours(0, 0, 0, 0)` écrit la veille ou repart en retard selon le fuseau du processus [L27].

Numéro attribué une fois par couple (boutique, client). Pour `ShopCustomer`, c'est `allocateCustomerNumber` (compteur, puis `INSERT … ON CONFLICT DO NOTHING`, puis relecture) : l'appeler. Le même patron sans SQL brut, pour un futur couple du même genre :

```ts
export async function shopCustomerNumber(tx: Prisma.TransactionClient, shopId: string, userId: string): Promise<number> {
  const key = { shopId_userId: { shopId, userId } };
  const known = await tx.shopCustomer.findUnique({ where: key, select: { number: true } });
  if (known) return known.number;
  const counter = await tx.customerCounter.upsert({ // verrou de ligne : une première commande à la fois par boutique
    where: { shopId },
    create: { shopId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const raced = await tx.shopCustomer.findUnique({ where: key, select: { number: true } }); // relire APRÈS le verrou
  if (raced) return raced.number;
  await tx.shopCustomer.create({ data: { shopId, userId, number: counter.lastNumber } });
  return counter.lastNumber;
}
```

Sans la relecture, deux premières commandes simultanées du même client donnent `P2002` une fois sur deux, et la transaction entière est perdue ; avec elle, 20 appels sur 20 réussissent et chaque client garde un seul numéro [L22]. La relecture voit la ligne de l'autre transaction parce qu'en `READ COMMITTED` chaque instruction relit l'état validé [PG1].

## 5. Invariant sur plusieurs lignes : verrou de transaction

```ts
const ACTIVE: Prisma.OrderWhereInput["status"] = { notIn: ["CANCELLED", "AUTO_CANCELLED", "DENIED"] };

return prisma.$transaction(
  async (tx) => {
    const lockKey = `slot:${shopId}:${slot.toISOString()}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`; // libéré au COMMIT ou au ROLLBACK
    const taken = await tx.order.count({ where: { shopId, pickupSlotStart: slot, status: ACTIVE } });
    if (taken >= maxOrdersPerSlot) throw new Error("SLOT_FULL");
    return tx.order.create({ data, select: { id: true, orderNumber: true } });
  },
  TRANSACTION_OPTIONS, // { maxWait: 5_000, timeout: 10_000 }, la constante des services de commande
);
```

Mesuré : 5 commandes sur un créneau de 5 pour 20 tentatives simultanées, 49 ms [L17] ; rejoué le 14/11 par le vérificateur, même résultat [L41].

Pour corriger D9 (`shop-capacity.ts`) : les deux `count` de `checkShopCanTakeOrder` (aujourd'hui hors transaction) passent au début de la transaction d'`insertOrder` dans `create.ts` — verrou, comptages, puis le reste. La lecture du statut de la boutique (`getShopStatus`, qui appelle Redis) reste **dehors** : pas d'appel réseau dans une transaction. Le plafond horaire (`maxOrdersPerHour`) dépend lui aussi d'autres lignes : un seul verrou par boutique (`capacity:<shopId>`) couvre les deux plafonds ; les créations d'une même boutique se suivent alors une à une, ce que le compteur annuel impose déjà à toute la plateforme (§ 4). Prendre ce verrou **en premier**, avant l'offre et les compteurs, et dans le même ordre partout [PG2]. Preuve attendue : un test d'intégration à 20 créations simultanées sur un créneau de 5 (modèle : `tests/integration/orders/create-order-concurrency.test.ts`).

- `$executeRaw`, pas `$queryRaw` : la fonction rend `void` et `$queryRaw` échoue en `P2010` [L18].
- Verrou **de transaction** (`…_xact_lock`), jamais de session (`pg_advisory_lock`) : un verrou de session survit à la transaction et n'est pas pris en charge par PgBouncer en mode transaction [PG2][PGB1]. Le verrou de transaction ne figure pas dans les limites de PgBouncer [PGB1] ; nous ne l'avons pas mesuré à travers un pooler.
- La clé nomme l'invariant (`slot:<boutique>:<instant>`, `hour:<boutique>`). Tout chemin qui crée une commande sur ce créneau doit prendre le même verrou, sinon il ne protège rien.
- Variante : `SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE` par `tx.$queryRaw` (46 ms [L17]). Plus simple à lire, mais elle met aussi en file tout ce qui modifie ou référence la boutique pendant la transaction.
- Un compteur matérialisé (`slot_counts`) gardé par `updateMany` conditionnel est l'autre voie ; elle demande une table et sa remise à niveau à chaque annulation.

## 6. Règles d'une transaction interactive

1. **Uniquement `tx.`** dans le callback. Un `prisma.` s'y exécute sur une autre connexion, donc **hors** de la transaction : il ne voit pas ses écritures et n'est pas annulé avec elle. Avec `connection_limit=1` (réglage documenté de la production), il attend la connexion que la transaction tient ; mesuré : la transaction expire à son `timeout` (`P2028`, tout est annulé), **puis** la requête `prisma.` s'exécute seule ; si `pool_timeout` est plus court que ce `timeout`, c'est elle qui échoue en `P2024` [L26][L40]. Dans les deux cas la requête HTTP a perdu 5 à 10 s.
2. **Aucun appel réseau** (Stripe, e-mail, push, Redis) et aucune requête lente à l'intérieur [PR1]. Les effets externes partent après le `COMMIT`.
3. **Courte** : défauts Prisma `maxWait` 2 s, `timeout` 5 s [PR1] ; les services de commande passent `{ maxWait: 5_000, timeout: 10_000 }` (constante `TRANSACTION_OPTIONS` de chaque fichier) : reprendre cette valeur, ne pas l'augmenter sans raison écrite. Au-delà du `timeout`, `P2028` et annulation [L26].
4. **Ne jamais attraper une erreur de base pour continuer.** Après une erreur, PostgreSQL refuse toute instruction (`25P02`) et rien n'est validé, pas même ce qui précédait [L21]. Laisser l'erreur sortir, puis décider dehors (rejouer, répondre 409).
5. `Promise.all` à l'intérieur n'accélère rien : une transaction = une connexion = une requête à la fois [PR1].
6. Lire **avant** la transaction ce qui peut l'être (produits, boutique, validation) ; n'y laisser que les gardes et les écritures.
7. Les écritures imbriquées (`order.create` avec `items: { create: [...] }`) sont déjà atomiques [PR1] : pas besoin de transaction pour elles seules.
8. `$transaction([...])` exécute dans l'ordre [PR1] ; aucune lecture intermédiaire n'y est possible.

## 7. Rejouer

Rejouer **toute** la transaction, jamais une instruction, et seulement pour une erreur qui le justifie :

```ts
export async function withTxRetry<T>(run: () => Promise<T>, retryOn: readonly string[] = ["P2034"], attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
      if (attempt >= attempts || code === null || !retryOn.includes(code)) throw error;
    }
  }
}
```

- `P2034` (conflit d'écriture, interblocage) : toujours rejouable [PR1].
- `P2002` : seulement quand la contrainte en cause signifie « un autre vient de créer la même chose » et que le second passage lira cette création. Sur une clé d'idempotence, `P2002` veut dire « déjà traité » : relire et répondre, ne pas rejouer.
- Une fonction rejouée ne doit avoir aucun effet externe.

## 8. Journal dans une colonne JSON

Lire un tableau JSON, lui ajouter un élément et le réécrire perd 9 ajouts sur 10 en concurrence [L23] ; toute mise à jour d'un `jsonb` réécrit la valeur entière et verrouille la ligne [PG9]. Un journal appartient à une table (`OrderEvent` existe). Tant que `Order.notifSent` subsiste, y ajouter par une seule instruction, qui sert aussi de garde « une seule fois » :

```ts
export async function appendNotifOnce(orderId: string, event: string, at: Date): Promise<boolean> {
  const marker = JSON.stringify([{ event }]);
  const entry = JSON.stringify([{ event, at: at.toISOString() }]);
  const changed = await prisma.$executeRaw`
    UPDATE orders
    SET notif_sent = coalesce(notif_sent, '[]'::jsonb) || ${entry}::jsonb, updated_at = now() AT TIME ZONE 'UTC'
    WHERE id = ${orderId} AND NOT (coalesce(notif_sent, '[]'::jsonb) @> ${marker}::jsonb)`;
  return changed === 1; // true = à nous d'envoyer
}
```

Mesuré : 1 gagnant sur 10, 1 entrée [L23]. Tous les écrivains de la colonne doivent passer par la même fonction.

## 9. Erreurs à reconnaître

Par **code**, jamais par fragment de message.

| Erreur | Sens | Réaction |
|---|---|---|
| `P2002` | Contrainte unique. `meta.target` liste les colonnes **SQL** (`["idempotency_key"]`, `["shop_id","user_id"]`), pas les noms de champs Prisma [L36] | « Déjà fait » (idempotence) ou 409 ; voir § 7 |
| `P2003` | Clé étrangère : parent absent, ou `Restrict` qui bloque une suppression [PR22] | 409 ou 422 selon le cas |
| `P2025` | `update` / `delete` sur une ligne absente | Préférer `updateMany` + `count`, qui ne lève pas |
| `P2034` | Conflit d'écriture ou interblocage | Rejouer la transaction |
| `P2028` | Transaction expirée | Chercher d'abord un `prisma.` dans le callback (§ 6, règle 1) ; sinon raccourcir ; ne pas relever le délai sans raison écrite |
| `P2010` avec `meta.code` `23505` | Violation d'unicité levée par `$executeRaw` / `$queryRaw` : ce n'est **pas** un `P2002` et `uniqueViolationFields()` rend `null` [L41] | Préférer `ON CONFLICT` dans le SQL ; sinon tester `meta.code` |
| `PrismaClientUnknownRequestError` contenant `25P02` | Erreur attrapée dans une transaction (§ 6, règle 4) | Corriger le code |
| `PrismaClientUnknownRequestError` « Value … not found in enum » | Valeur d'enum inconnue du client déployé [L32] | Problème de migration (`migrations.md` § 3) |

```ts
/** `column` = nom SQL de la colonne, par exemple "idempotency_key". */
export function isUniqueViolation(error: unknown, column?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const columns = error.meta?.target;
  return column === undefined || (Array.isArray(columns) && columns.includes(column));
}
```
