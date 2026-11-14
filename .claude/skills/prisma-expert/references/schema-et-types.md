# Schéma et types : argent, temps, JSON, suppression, journal, seed et bases de test

`[L…]` : `verifications-locales.md`. `[PR…]`, `[PG…]` : `sources.md`. Relevé sur l'arbre de travail du 14/11/2026 (chantier 0 compris).

## Sommaire

1. Conventions du schéma (à reproduire)
2. Argent et taux
3. Temps : instants, jours de Paris
4. JSON ou table
5. Suppression logique, anonymisation, journal
6. Seed, bases de test, données de volume

## 1. Conventions du schéma (à reproduire)

| Élément | Convention en place | Exemple |
|---|---|---|
| Identifiant | `String @id @default(cuid())` ; la valeur vient du client, la colonne SQL `text` n'a pas de défaut [L4]. Un `INSERT` en SQL brut doit donc fournir l'`id` | `Order.id` |
| Noms | Modèle PascalCase + `@@map("snake_case_pluriel")` ; champ camelCase + `@map("snake_case")` | `shopId @map("shop_id")`, `@@map("orders")` |
| Horodatages | `createdAt DateTime @default(now()) @map("created_at")`, `updatedAt DateTime @updatedAt @map("updated_at")` | partout |
| Tenant | `shopId` obligatoire sur toute donnée métier d'une boutique, relation vers `Shop`, en **tête** d'un index | `Product`, `Order`, `Offer` |
| Relation | `onDelete` écrit explicitement (20 relations n'en ont pas : défaut `Restrict` si obligatoire, `SetNull` si optionnelle [PR22]) | `ShopLog.shop … onDelete: Cascade` |
| Unicité | Contrainte en base (`@unique`, `@@unique`), jamais un `findFirst` de contrôle | `Order.idempotencyKey`, `ShopCustomer [shopId, userId]` |

Avant d'ajouter un modèle ou un champ, lancer `node .claude/skills/prisma-expert/scripts/schema-audit.mjs` : il signale clé étrangère sans index, index doublon, `Float` monétaire, référence sans contrainte, relation sans `onDelete`.

## 2. Argent et taux

- **Montant = `Int` en centimes**, suffixe `Cents` (CLAUDE.md, « Conventions »). `integer` va jusqu'à 2 147 483 647 [PG10], soit 21 millions d'euros : suffisant pour une commande, pas pour un cumul plateforme, d'où `Shop.monthlyGmvCents BigInt`. Un `BigInt` arrive en `bigint` JavaScript : le convertir explicitement avant `JSON.stringify` [L15].
- **Jamais `Float` pour un montant** : `double precision` est inexact et l'égalité entre flottants n'est pas fiable [PG10]. Écarts en place (D15) : `Order.discountAmount` (euros, doublon de `discountCents`, encore écrit par `create.ts` comme `discountCents / 100`), `Offer.discountValue`, `Offer.minOrder`, `Shop.commissionPct`, `Shop.vatRate`, `Product.vatRate`, `LoyaltyReward.rewardPercent`.
- **Taux** (TVA, commission, pourcentage) : nouveau champ en entier dans une unité explicite (`vatRateBp Int` en points de base, 550 = 5,5 %) ou `Decimal @db.Decimal(5, 2)` [PR19]. `Decimal` revient côté client en objet `Prisma.Decimal`, pas en `number` : il ne se sérialise pas comme un nombre et ne s'additionne pas avec `+`. Préférer l'entier, sauf arbitrage A5.
- Remplacer un `Float` existant = changement de type : nouvelle colonne, double écriture, reprise, bascule (`migrations.md` § 3). Jamais `ALTER COLUMN … TYPE`.
- Arrondi : une seule fonction par calcul, côté serveur, sur des entiers. Le chantier de prix des commandes, en cours, les place dans `src/lib/pricing/` (`line.ts`, `totals.ts`, `discount.ts`, `unit-price.ts`) et `src/lib/services/orders/quote.ts` : les appeler, ne pas recalculer un prix dans une route ni dans une requête.

## 3. Temps : instants, jours de Paris

- `DateTime` produit `timestamp(3) without time zone` [L4][PR19] ; Prisma y écrit l'instant **UTC**. Les requêtes de modèle Prisma ne dépendent pas du fuseau de session ; le SQL brut si [L37] (`index-et-requetes.md` § 6, règle 5).
- Le wiki PostgreSQL préfère `timestamptz` mais tolère `timestamp` quand l'application ne fait que stocker et relire des instants UTC [PG14] : c'est notre cas. **Ne pas convertir** les colonnes existantes : `timestamp` → `timestamptz` réécrit la table et décale les valeurs si la session n'est pas en UTC [L11]. Arbitrage A7.
- **Jour calendaire** (compteur de tickets, chiffre du jour, export) : c'est le jour **de Paris**. Le calculer par `getParisWallClock(now)` (`year`, `month`, `day`, `dateKey`) de `src/lib/paris-time.ts`. Pour une colonne `@db.Date` : `new Date(Date.UTC(year, month - 1, day))`. Interdit côté serveur : `setHours(0, 0, 0, 0)`, `toISOString().slice(0, 10)`, `new Date().getHours()` — sur Vercel (UTC) une commande de 00:30 à Paris tombe la veille [L27] (D8).
- **Bornes d'une période** : demi-ouvertes `{ gte: début, lt: fin }`, jamais `lte` sur la fin ni `BETWEEN` [PG14]. Début et fin d'un jour de Paris : `parisWallClockToUtc(dateKey, 0)` et `parisWallClockToUtc(dateKey, 1440)`.
- Un champ qui représente une heure d'ouverture ou un créneau « 13:30 » n'est pas un instant : il reste une chaîne ou des minutes depuis minuit, interprétées en heure de Paris (`openingHours`, CLAUDE.md « Horaires & fuseau »).
- `updated_at` n'a ni défaut ni déclencheur : toute écriture en SQL brut doit le poser (`now() AT TIME ZONE 'UTC'`) [L4]. Sinon l'historique cuisine (fenêtre et tri sur `updatedAt` dans `kitchen.ts`), le jeton d'édition concurrente [L39] et la sonde de version prévue par `order-lifecycle-realtime` ne voient pas le changement.

## 4. JSON ou table

`Json` = `jsonb` [PR19]. Toute mise à jour réécrit le document entier et verrouille la ligne [PG9] ; le client ne type pas le contenu [PR16].

| Le contenu… | Choix | Chez nous |
|---|---|---|
| est un instantané figé, lu et écrit d'un bloc | `Json`, validé par Zod à l'écriture **et** à la lecture | `RecurringOrder.itemsSnapshot`, `PriceAdjustment.itemsSnapshot`, `Recipe.steps` |
| est une configuration d'une entité, petite, modifiée d'un bloc | `Json` acceptable, schéma Zod partagé | `Shop.openingHours`, `Shop.pickupSlots`, `Product.cutOptions` |
| grossit avec le temps, reçoit des ajouts concurrents, ou sert de garde « une fois » | **table** | `OrderEvent` existe ; `Order.notifSent` est l'écart D12 |
| est filtré, trié, joint, agrégé, ou référence une autre ligne | **colonne** ou **table** avec clé étrangère | — |

- Lire un `Json` : `Prisma.JsonValue`, puis `schema.safeParse(value)` ; jamais un `as` vers un type métier.
- Écrire « pas de valeur » : `Prisma.DbNull` (SQL `NULL`) ou `Prisma.JsonNull` (JSON `null`) [PR16] ; les deux ne se filtrent pas de la même façon.
- Ajout concurrent à un tableau JSON existant : une seule instruction SQL (`transactions-concurrence.md` § 8), jamais lecture puis réécriture (9 ajouts perdus sur 10 [L23] : c'est encore le cas dans `lib/notifications.ts`, `orders/[id]/scheduled-notify` et `cron/ready-reminder`).

## 5. Suppression logique, anonymisation, journal

État : seul `User` porte `deletedAt`, posé par `src/app/api/users/me/route.ts` qui anonymise aussi le compte ; **aucune lecture ne le filtre** (D17). Il n'existe ni extension ni filtre global (`prisma.$use` n'existe plus en 6.19 ; seul `$extends` existe).

Décision par type de donnée :

| Donnée | Traitement |
|---|---|
| Compte client supprimé | Anonymisation + `deletedAt` ; les commandes restent (comptabilité, boucher). Toute lecture « personnes actives » (campagnes, audiences, recherche) ajoute `deletedAt: null`. Durées de conservation : skill `conformite-france` |
| Produit, offre retirés du catalogue | Champ d'état métier existant (disponibilité, statut d'offre), pas de `DELETE` : des `OrderItem` les référencent (`Restrict`, `P2003` [PR22]) |
| Commande | Jamais supprimée ; statut terminal (`order-lifecycle-realtime`) |
| Donnée technique éphémère (panier, session, notification lue) | Suppression physique, purge par lots (`background-jobs-notifications`) |

Si une nouvelle suppression logique est ajoutée :

- un filtre explicite `deletedAt: null` dans chaque requête concernée, écrit dans un helper du domaine (`activeUserWhere`), plutôt qu'une extension `$extends` qui masque le filtre au lecteur et ne couvre pas le SQL brut ;
- une unicité qui doit ignorer les lignes supprimées demande un **index unique partiel** en SQL (`… WHERE deleted_at IS NULL`), invisible de Prisma et absent des bases nées de `db push` [PG12][L5] : à documenter en commentaire du modèle ;
- penser aux relations : `include` d'un parent supprimé le renvoie quand même.

Journal :

- **Événements d'une commande** : `OrderEvent` (une ligne par transition, écrite dans la même transaction que le changement, `src/lib/services/orders/transition.ts`).
- **Actions d'administration** : `AuditLog` (`actorId`, `action`, `target`, `targetId`, `details Json`).
- **Événements de boutique** : `ShopLog`.
- Une ligne de journal est **insérée**, jamais modifiée ; elle s'écrit dans la transaction de l'action qu'elle décrit quand l'action est en base. Ces tables grossissent sans fin : index `[shopId, createdAt]` ou `[createdAt]`, lecture paginée par clé, purge planifiée.

## 6. Seed, bases de test, données de volume

- **`prisma/seed.ts` est destructeur** : 26 `deleteMany()` sans filtre, `new PrismaClient()` sur `DATABASE_URL`, aucune garde d'hôte (D18). En v6, Prisma le lance seul après `migrate reset` et quand `migrate dev` réinitialise la base [PR12]. Règle : `db:seed` et `db push` s'exécutent sans confirmation, l'hôte affiché par la CLI ne protège de rien ; ne les lancer qu'avec les deux URL écrites en valeur littérale locale sur la ligne de commande (`verifications-locales.md`, « Refaire une vérification »). Avant toute autre modification du seed, lui ajouter la même garde « hôte local seulement » que `tests/integration/setup/database-url.ts` (`integrationDatabaseUrl`).
- **Tests unitaires** (`src/lib/__tests__`, `npm run test`) : fonctions pures, pas de base (CLAUDE.md).
- **Tests d'intégration** (`tests/integration`, `npm run test:integration`) : PostgreSQL **local** seulement. Lancement : `DATABASE_URL="postgresql://<utilisateur>:<mot de passe>@127.0.0.1:<port>/<base>" npm run test:integration` (la variable doit être dans l'environnement ; un hôte autre que `localhost`, `127.0.0.1` ou `::1` est refusé avant toute connexion). Schéma `itest` poussé par `db push` dans `global-setup.ts`, verrou consultatif entre lancements, `resetDatabase()` / `useCleanDatabase()` de `tests/integration/helpers/db.ts`, fabriques dans `helpers/factories.ts` (`createTestShop`, `createTestOrder`…). Toute garde de concurrence (écriture conditionnelle, verrou, compteur) se prouve ici, avec des appels simultanés (`Promise.all` de 10 à 20 appels) et une assertion sur l'état final — c'est ainsi que les mesures `[L17]` à `[L25]` ont été obtenues.
- Limite connue : `db push` ne crée ni l'index trigramme, ni les index partiels ou `CHECK` écrits en SQL [L3][L5] ; un test ne peut pas compter sur eux. Un test ne prouve pas non plus que les migrations reconstruisent le schéma (D1).
- **Données de volume** pour un plan d'exécution : base jetable de `verifications-locales.md` (« Refaire une vérification »), jamais une copie de production sur un poste.
- Fabriques : chaque test crée ses propres boutiques ; deux tests ne partagent jamais un `shopId` (c'est aussi ce qui prouve l'isolation multi-tenant).
