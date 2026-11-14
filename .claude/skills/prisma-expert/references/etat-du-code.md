# État du code — données et requêtes

Relevé le 14/11/2026 sur `HEAD 32c581f` **et l'arbre de travail**, où le chantier 0 (intégrité et prix des commandes) avance : `prisma/schema.prisma` modifié, migration `20261113120000_chantier0_order_integrity` et plusieurs services de `src/lib/services/orders/` non commités. Le dépôt bouge d'heure en heure : avant de citer un chiffre ou une ligne, relancer les scripts et relire le fichier.

```bash
node .claude/skills/prisma-expert/scripts/schema-audit.mjs
node .claude/skills/prisma-expert/scripts/query-audit.mjs --quiet
node .claude/skills/prisma-expert/scripts/migration-lint.mjs --all
```

`[L…]` renvoie à `verifications-locales.md`, `[PR…]`, `[PG…]`, `[V…]`, `[RW…]` à `sources.md`. Les changements de **statut** de commande sont tenus par le skill `order-lifecycle-realtime`.

## Sommaire

- Vue d'ensemble
- Modèles de référence à imiter (chantier 0)
- Ce qui est déjà bien fait
- Écarts D1 à D22
- Erreurs de l'ancien skill (février 2026)

## Vue d'ensemble

| Mesure (14/11/2026) | Valeur |
|---|---|
| Modèles, enums | 51 modèles, 28 enums, 1 849 lignes de schéma |
| Clés étrangères | 55, dont 10 sans index (D3) |
| `@@index` | 85, dont 9 redondants (D4) ; 4 index n'existent que dans le SQL des migrations (D2) |
| Champs `Json` / `Float` | 20 / 24, dont 7 `Float` portent un montant ou un taux (D15) |
| `findMany` | 174, dont 62 sans `take` ni liste `in:` et 26 bornés par une liste (D5) — relevé `query-audit.mjs` du 14/11 |
| Boucles de requêtes | 6 candidats (D6) |
| Pagination `skip` | 8 sites (D7) |
| SQL brut | gabarits étiquetés uniquement côté application ; aucun `…Unsafe` dans `src/` |
| Migrations | 14 dossiers ; l'historique ne reconstruit pas la base (D1) |
| Tests base réelle | projet Vitest `integration` (`npm run test:integration`), schéma `itest` d'un PostgreSQL **local**, poussé par `db push` |

## Modèles de référence à imiter (chantier 0)

Ces fichiers appliquent déjà les règles du skill ; un nouveau code de données s'en inspire plutôt que des anciennes routes.

| Fichier | Ce qu'il montre |
|---|---|
| `src/lib/services/orders/numbering.ts` | Numéros alloués par `INSERT … ON CONFLICT DO UPDATE … RETURNING` dans la transaction de création ; jour et année **de Paris** (`getParisWallClock`) ; numéro client par boutique sans `P2002` grâce à `ON CONFLICT DO NOTHING` puis relecture |
| `src/lib/services/orders/discount-ledger.ts` | Consommation d'une offre ou d'une récompense par `updateMany` gardé (référence de champ `tx.offer.fields.maxUses`) ; libération symétrique |
| `src/lib/services/orders/limited-stock.ts` | Décrément gardé par `shopId`, lignes triées par `productId` pour verrouiller dans un ordre constant (pas d'interblocage), annulation par exception si le stock passe sous 0 |
| `src/lib/services/orders/transition.ts` | Écriture conditionnelle du statut + `OrderEvent` dans la même transaction ; périmètre (`shopId` / `userId`) dans le `WHERE` |
| `src/lib/services/orders/create.ts` | Idempotence par `Order.idempotencyKey @unique` ; effets externes (`announceNewOrder`) **après** le `COMMIT` ; erreurs métier levées dans la transaction et traduites dehors |
| `src/lib/prisma-errors.ts` | `uniqueViolationFields(error)` : lecture typée de `P2002` (`meta.target` = colonnes SQL) |
| `prisma/migrations/20261113120000_chantier0_order_integrity/` | Migration additive écrite à la main, rejouable, `SET lock_timeout`, en-tête qui explique pourquoi le code N−1 continue de marcher, `rollback.sql` |
| `tests/integration/` | Garde « hôte local seulement » (`setup/database-url.ts`), verrou consultatif entre lancements, `resetDatabase()` qui refuse tout schéma autre qu'`itest` |

Réserves sur ces modèles :

- Les services de commande fixent `maxWait: 5_000, timeout: 10_000` (`create.ts`, `transition.ts`, `commands/accept.ts`, `commands/progress.ts`, `commands/rate.ts`, chacun sa constante locale `TRANSACTION_OPTIONS`) au lieu des défauts Prisma (2 s / 5 s [PR1]). Réutiliser cette constante plutôt qu'en inventer une autre ; ne pas monter au-delà sans raison écrite (`maxDuration` des fonctions : 30 s).
- La migration du chantier 0 mêle structure et reprise de données dans la même transaction (`ALTER TABLE "orders" ADD COLUMN` puis `UPDATE "orders"` de toute la table) : acceptable au volume actuel, à ne pas imiter sur une grande table (le verrou de l'`ALTER` dure jusqu'au `COMMIT`).
- `ShopCustomer.userId` n'est en tête d'aucun index (la clé commence par `shopId`) : supprimer un utilisateur parcourra la table (D3).
- `src/lib/services/order-number.service.ts` (« nombre de commandes du jour + 1 ») et `services/cron.service.ts` ont été supprimés par le chantier 0 : ne pas les recréer.

## Ce qui est déjà bien fait

- **Singleton** `src/lib/prisma.ts` conforme au motif recommandé [PR3] ; aucun `new PrismaClient` dans `src/` hors de ce fichier (les scripts et le setup des tests en créent un, voir D18).
- **Nommage** : modèles en PascalCase, colonnes et tables en snake_case par `@map` / `@@map`, identifiants `cuid()` générés par le client.
- **Chemins chauds indexés** : liste des commandes d'une boutique, commandes actives, créneau, balayage des expirées, et l'index `[shopId, updatedAt]` qu'attend la future sonde de version [L28a à L28f].
- **Argent en centimes entiers** sur `Order`, `OrderItem`, `Product` ; `Shop.monthlyGmvCents` en `BigInt`.
- **Migrations appliquées par la chaîne de build**, en production seulement (`scripts/prisma-migrate-prod-only.mjs`), par connexion directe (`directUrl`).

## Écarts

### Migrations

**D1 — L'historique des migrations ne reconstruit pas la base.** `init` crée un ancien schéma (16 tables) et la plupart des tables actuelles ont été créées par `db push`. Sur une base vide, `migrate deploy` échoue à la 3ᵉ migration [L1]. Donc `npm run db:migrate` (`migrate dev`) et `npm run db:reset` ne fonctionnent pas ; la CI et les tests passent par `db push` et ne prouvent pas que les migrations produisent le schéma. Remède : baseline (`migrations.md` § 7), arbitrage A1.

**D2 — Quatre index vivent hors de `schema.prisma`** : `orders(shop_id, paid_at)`, `orders(stripe_payment_intent_id)`, `orders(stripe_checkout_session_id)`, GIN trigramme sur `products(name)`. Toute commande Prisma qui compare le schéma à une base qui les porte veut les supprimer [L2] ; les bases nées de `db push` (CI, tests) ne les ont pas. Les trois premiers se déclarent sans risque ; le quatrième pose un problème d'extension et de schéma [L3], arbitrage A1.

**D19 — Migrations passées incompatibles avec le code alors en place** (`migration-lint.mjs --all`, 4 erreurs) : `ALTER TYPE "OfferType" RENAME VALUE`, `DROP TABLE subscriptions` et `plan_features`, `ALTER COLUMN monthly_gmv_cents TYPE BIGINT`, plus des `CREATE INDEX` bloquants sur des tables existantes. Sans conséquence connue au volume d'alors ; à ne pas reproduire.

### Index

**D3 — 10 clés étrangères sans index** : `CartItem.cartId`, `CartItem.productId`, `OrderItem.productId`, `Cart.shopId`, `RecurringOrder.shopId`, `SuggestRule.sourceProductId`, `SuggestRule.targetProductId`, `Campaign.offerId`, `OfferProduct.shopId`, `ShopCustomer.userId`. PostgreSQL n'indexe pas la colonne référençante [PG7]. Supprimer un produit parcourt `order_items` (45,5 ms contre 2,8 ms avec index à 700 000 lignes [L30]) ; chaque synchronisation de panier supprime puis relit `cart_items` par `cart_id` sans index (`src/app/api/cart/route.ts`).

**D4 — 9 index redondants** : `Order [userId]`, `Order [status, expiresAt]` et `[expiresAt, status]` (mêmes colonnes), `Product [shopId]`, `ProAccess [userId]`, `ShopMember [shopId]`, `SuggestRule [shopId]`, `PriceAdjustment [orderId]`, `LoyaltyReward [code]`, `Recipe [slug]` [PG13]. `orders` porte 17 index : 85 Mo pour 44 Mo de table sur le jeu de volume [L30]. Retrait seulement après lecture de `pg_stat_user_indexes` en production.

### Lectures

**D5 — Lectures non bornées.** 62 `findMany` sans `take` ni liste. Exemples : `cron/recalc-shop-tiers` (toutes les boutiques, sans `where`), `boucher/finances`, `boucher/finances/export`, `users/me/export`, `admin/shops`. `services/stats/boucher-stats.ts` charge jusqu'à 5 000 commandes, deux fois, pour additionner en JavaScript. Contre-exemple à imiter : `cron/auto-cancel` (réécrit par le chantier 0) lit un lot de 200 trié par `expiresAt`.

**D6 — Requêtes dans des boucles** (6 sites au 14/11). Le plus net : `cron/recalc-shop-tiers/route.ts`, un `aggregate` puis un `update` par boutique, là où un `groupBy` suffit [L28j]. Aussi `prospect-relances`, `import-csv`, `scrape-butchers`, `orders/[id]/adjustment/accept`, et `services/orders/commands/unavailable.ts` (un `updateMany` par ligne de commande, dans une transaction : borné par la taille d'une commande, acceptable).

**D7 — Pagination par décalage** sur 8 sites, dont `admin/orders/route.ts` qui ajoute un `count` et un `aggregate` de tout l'ensemble filtré à chaque page. Page profonde : 50,7 ms contre 0,11 ms par clé [L28g].

**D22 — Curseur natif mal employé.** `boucher/images/gallery/route.ts` trie sur `createdAt` seul (ordre indéterminé entre ex æquo [PG6]) et compte tout l'ensemble à chaque page ; `boucher/products/route.ts` trie sur trois colonnes, forme pour laquelle le curseur natif filtre au lieu de se positionner [L29].

**D8 — Jours calculés en UTC ou dans le fuseau du processus.** `toISOString().slice(0, 10)` dans `services/stats/boucher-stats.ts`, `boucher/finances`, `boucher/finances/export`, `admin/stats`, `orders/export`, `users/me/export` ; `setHours(0, 0, 0, 0)` dans `services/stats/boucher-stats.ts`, `admin/stats`, `admin/commission`, `webmaster/capacity`, `webmaster/billing`, `cron/calendar-alerts`. Sur Vercel (UTC), une commande payée à 00:30 heure de Paris tombe la veille [L27]. Remède : `src/lib/paris-time.ts` (CLAUDE.md, « Horaires & fuseau ») et `schema-et-types.md` § 3.

### Concurrence (hors statut de commande)

**D9 — Capacité vérifiée puis dépassée.** `services/orders/shop-capacity.ts` compte les commandes de l'heure et du créneau **hors transaction**, puis `create.ts` insère plus tard. Revérifié le 14/11 sur le schéma de l'arbre de travail : 20 créations simultanées sur un créneau de 5 → 20 acceptées ; avec `pg_advisory_xact_lock` dans la transaction → 5 [L17][L38]. Le contrôle est appelé par `create.ts` avant la transaction de création. Patron : `transactions-concurrence.md` § 5.

**D11 — Avis : unicité et moyenne.** Une contrainte `@@unique` qui contient une colonne nullable ne départage pas les lignes où cette colonne est nulle [L24][PG13] : l'unicité d'un avis se garantit en base (colonne obligatoire ou index unique partiel), jamais par un `findFirst` de contrôle avant le `create`. La note de la boutique se met à jour par `increment` atomique ou par `aggregate` dans la transaction qui écrit l'avis, jamais en valeur absolue calculée depuis une lecture antérieure (`transactions-concurrence.md` § 2). Preuve attendue : test d'intégration à appels simultanés. État actuel de l'écriture des avis : voir le registre privé du programme.

**D12 — Journal dans un tableau JSON.** `Order.notifSent` est complété par lecture puis réécriture dans `lib/notifications.ts`, `orders/[id]/scheduled-notify/route.ts` et `cron/ready-reminder/route.ts` : 9 ajouts perdus sur 10 en concurrence [L23], et la garde « déjà envoyé » ne protège pas d'un double envoi.

**D13 — Commentaire erroné** dans `services/stripe/connect.ts` : « Prisma ne supporte pas les locks row-level explicites en mode pgbouncer ». En mode transaction, PgBouncer garde la même connexion serveur du `BEGIN` au `COMMIT` ; seuls les états **de session** sont exclus [PGB1]. Le choix fait dans ce fichier (clé d'idempotence Stripe + écriture conditionnelle) reste bon.

Corrigés par le chantier 0 (arbre de travail, non commité au 14/11) : plafond d'offre et double consommation de récompense (ancien D10, `discount-ledger.ts`), numérotation hors transaction et jour du compteur de tickets (anciens D21 et D14, `numbering.ts` ; `numbering.service.ts` supprimé).

### Types et temps

**D15 — Montants et taux en `Float`** : `Order.discountAmount` (doublon en euros de `discountCents`, encore écrit par `create.ts`), `Offer.discountValue`, `Offer.minOrder`, `Shop.commissionPct`, `Shop.vatRate`, `Product.vatRate`, `LoyaltyReward.rewardPercent`. `double precision` est inexact [PG10]. Arbitrage A5.

### Intégrité

**D16 — Références sans contrainte.** `Shop.ownerId` n'est pas une relation et contient soit un identifiant Clerk, soit un identifiant Prisma : d'où la clause `OR` imposée par CLAUDE.md. 13 autres champs `…Id` sont de simples chaînes (`Order.loyaltyRewardId`, `LoyaltyReward.usedOnOrderId`, `Review.orderId`, `Notification.orderId`, `OrderEvent.shopId`, `PriceAdjustment.shopId`…). Arbitrage A6.

**D17 — Suppression logique jamais filtrée.** Seul `User` a `deletedAt`, posé par `api/users/me/route.ts` (qui anonymise aussi nom, téléphone, e-mail). Aucune lecture ne filtre `deletedAt`. Règle : toute audience ou tout envoi marketing exclut les comptes supprimés et ne retient que des personnes qui ont consenti (skill `conformite-france`), prouvé par un test d'intégration qui crée un compte supprimé et une personne sans consentement et vérifie qu'ils sont exclus. État actuel des audiences marketing : voir le registre privé du programme.

### Exploitation

**D18 — Seed destructeur sans garde.** `prisma/seed.ts` exécute 26 `deleteMany()` sans filtre, quel que soit l'hôte de `DATABASE_URL`. En v6, le seed part tout seul après `migrate reset` et quand `migrate dev` réinitialise [PR12]. Une douzaine de scripts de `scripts/` et `prisma/` créent leur propre `PrismaClient` sur `DATABASE_URL`. La garde « hôte local seulement » existe pour les tests d'intégration, pas pour le seed.

**D20 — Configuration de connexion non vérifiée et documents périmés.** CLAUDE.md et `audit/migrations.md` décrivent `DATABASE_URL` en `?pgbouncer=true&connection_limit=1`. (1) Avec Fluid compute, plusieurs requêtes partagent une instance [V1] et se mettent en file derrière l'unique connexion [L26] ; Vercel déconseille un pool maximal de 1 [V2] et Prisma ne recommande 1 que sans pooler externe [PR3]. (2) L'hôte `…proxy.rlwy.net` cité par CLAUDE.md est le proxy TCP public de Railway [RW1], pas la preuve d'un pooler. (3) `audit/db-runbook.md` parle de Prisma 5.x, montre un `ALTER TABLE "Order"` (la table s'appelle `orders`) et un `DELETE FROM _prisma_migrations` manuel. Arbitrages A2 et A3.

Autres constats tenus par d'autres skills : purge des tables qui grossissent sans fin (`notifications`, `chat_messages`, `audit_logs`, `shop_logs`, `order_events`, `stripe_events`) : `background-jobs-notifications` et `conformite-france` ; traduction des erreurs Prisma en réponses HTTP (`src/lib/api/errors.ts`) : `api-route-conventions` ; région des fonctions (`sfo1`) : `vercel-cost-performance`.

## Erreurs de l'ancien skill (février 2026)

Il recommandait `prisma.$use` (absent du client 6.19.2 : seul `$extends` existe) ; présentait `db push` comme pratique de production ; donnait `connection_limit=10&pool_timeout=30` pour Railway ; présentait `take` + `skip` comme la pagination de référence ; listait un rôle `WEBMASTER` absent de l'enum `Role` ; utilisait `@default(uuid())` alors que le schéma est en `cuid()` ; conseillait un `findFirst` de contrôle avant chaque écriture ; décrivait un `Float` comme « décimal » ; portait la clé de frontmatter `user_invocable`, ignorée.
