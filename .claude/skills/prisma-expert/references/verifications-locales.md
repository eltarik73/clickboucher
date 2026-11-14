# Vérifications locales

Toutes rejouées le **13/11/2026** par le formateur qui signe cette version, pour ne rien affirmer sur la seule foi d'une documentation ou d'un brouillon. Rien n'a touché la production ni le dépôt : base PostgreSQL jetable en conteneur local, schéma **de l'arbre de travail** (chantier 0 compris) copié hors du dépôt, client Prisma généré dans le dossier de travail.

**Environnement** : Prisma CLI et client 6.19.2 (moteur Rust, aucune `previewFeatures`), Node 22.22.0, TypeScript 5.9.3, PostgreSQL 15.19 (`postgres:15-alpine`, fuseau `UTC`, `READ COMMITTED`), machine à 8 cœurs, **sans PgBouncer**. La CI utilise PostgreSQL 16 ; la version de production n'est pas connue. Un résultat lié au planificateur ou aux verrous peut différer d'une version majeure à l'autre : refaire la mesure en cas de doute.

**Jeu de volume** (L28 à L30) : 200 boutiques, 5 000 utilisateurs, 20 000 produits, 300 000 commandes sur 400 jours (20 boutiques concentrent un tiers du volume ; la plus chargée en a 6 000), 700 000 lignes de commande. Données synthétiques : les durées donnent des ordres de grandeur, pas des valeurs de production.

## Sommaire

- Migrations et schéma (L1 à L11, L32 à L35)
- SQL émis par Prisma (L12 à L16, L36)
- Concurrence (L17 à L25, L38, L39) et contrôle indépendant du vérificateur (L41, L42)
- Pool de connexions et transactions (L26, L40)
- Dates (L27, L37)
- Plans d'exécution (L28 à L30)
- Compilation des extraits (L31)
- Refaire une vérification

## Migrations et schéma

| Id | Question | Résultat |
|---|---|---|
| L1 | Les migrations du dépôt recréent-elles la base ? | **Non.** `prisma migrate deploy` sur une base vide échoue à la 3ᵉ migration (`20260422000000_add_missing_indexes`) : `P3018`, erreur PostgreSQL `42703` « column "expires_at" does not exist ». La migration `init` crée un ancien schéma (16 tables) ; la plupart des tables actuelles ne sont créées par aucune migration |
| L2 | Que ferait Prisma d'une base « comme la production » (schéma courant + index créés par les migrations SQL) comparée à `schema.prisma` ? | `migrate diff --from-url … --to-schema-datamodel … --script` émet 4 `DROP INDEX` : `orders_shop_id_paid_at_idx`, `orders_stripe_checkout_session_id_idx`, `orders_stripe_payment_intent_id_idx`, `idx_products_name_trgm` |
| L3 | Quelles lignes de schéma rendent ce diff vide ? | Sur `Order` : `@@index([shopId, paidAt])`, `@@index([stripePaymentIntentId])`, `@@index([stripeCheckoutSessionId])`. Sur `Product` : `@@index([name(ops: raw("gin_trgm_ops"))], type: Gin, map: "idx_products_name_trgm")`. Avec `--exit-code` : 0. **Mais** la ligne trigramme fait échouer `db push` sur toute base sans l'extension (`operator class "gin_trgm_ops" does not exist`), donc la CI, et dans un schéma autre que `public` même avec l'extension (cas de `?schema=itest`). Écrite `raw("public.gin_trgm_ops")`, elle passe dans `itest` mais le diff contre la base « production » redevient `DROP` + `CREATE`. Les trois lignes `Order` ne posent aucun de ces problèmes |
| L4 | Quels types SQL produit le schéma ? | `DateTime` → `timestamp(3) without time zone` ; `Json` → `jsonb` ; `Float` → `double precision` ; `Int` → `integer` ; `@db.Date` → `date` ; `id` : `text` sans défaut SQL (le `cuid()` vient du client) ; `created_at` : défaut `CURRENT_TIMESTAMP` ; `updated_at` : **aucun** défaut ni déclencheur (la valeur vient du client) |
| L5 | Prisma touche-t-il un index partiel, un index unique partiel ou une contrainte `CHECK` créés en SQL ? | Non : `migrate diff --from-url` rend « empty migration » et `db push` répond « already in sync » ; les trois objets sont toujours là. Prisma 6.19.2 ne les voit pas. Conséquence inverse : une base née de `db push` (CI, tests) ne les a pas |
| L6 | Quel SQL sépare le schéma de `HEAD` de celui de l'arbre de travail (chantier 0) ? | `migrate diff --from-schema-datamodel <HEAD> --to-schema-datamodel prisma/schema.prisma --script`, **sans base** : `ADD COLUMN "customer_number" INTEGER`, `ALTER COLUMN "service_fee_cents" SET DEFAULT 0`, deux `CREATE TABLE`, un index unique, deux clés étrangères. Uniquement additif |
| L7 | Une baseline tirée du schéma répare-t-elle l'historique ? | Oui en local : `0_init` = `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + sortie de `migrate diff --from-empty --to-schema-datamodel … --script` (1 638 lignes, schéma avec les 4 lignes de L3) s'applique sur base vide ; `migrate diff --from-migrations … --to-schema-datamodel … --shadow-database-url …` répond « No difference detected » |
| L8 | `CREATE INDEX CONCURRENTLY` dans une migration Prisma ? | Seul dans son fichier : appliqué, index valide. Précédé de `SET lock_timeout = '5s';` dans le même fichier : `P3018`, erreur `25001` « cannot run inside a transaction block ». Le déploiement suivant échoue en `P3009` jusqu'à `migrate resolve --rolled-back <nom>` ; après correction du fichier, `migrate deploy` passe et `_prisma_migrations` garde deux lignes pour ce nom (l'échec avec `rolled_back_at`, puis le succès) |
| L9 | Peut-on borner l'attente de verrou d'une migration ? | Oui, sur une connexion directe : `?options=-c%20lock_timeout%3D3s` sur l'URL. Face à une transaction ouverte qui avait lu la table, `ALTER TABLE … ADD COLUMN` a échoué au bout de 3 s (`55P03`, `P3018`). Un `SELECT` simple arrivé pendant l'attente a mis 2,7 s : il était bloqué derrière l'`ALTER` en file. `SET lock_timeout` en tête du fichier fonctionne aussi tant que le fichier ne contient pas de `CONCURRENTLY` |
| L10 | Que génère Prisma pour les changements courants ? (`migrate diff` de schéma à schéma) | Ajout de valeur d'enum : `ALTER TYPE … ADD VALUE`. Retrait : nouveau type + `ALTER COLUMN "status" TYPE … USING` sur `orders`. Champ renommé avec son `@map` : `DROP COLUMN` + `ADD COLUMN`, **sans avertissement**. Champ renommé en gardant `@map` : migration vide. Index : `CREATE INDEX` sans `CONCURRENTLY`. `Int` → `BigInt` et `Float` → `Int` : `SET DATA TYPE`. Champ obligatoire sans défaut : `ADD COLUMN … NOT NULL`. Retrait d'un `@@index` : `DROP INDEX` |
| L11 | `timestamp(3)` → `timestamptz(3)` réécrit-il la table ? | Oui sur 15.19, même en session `UTC` (`pg_relation_filenode` change, index compris). En session `Europe/Paris`, la conversion décale les instants de 2 h (22:30 relu 20:30 UTC) : toute conversion devrait forcer `UTC` |
| L32 | Un client Prisma généré **avant** l'ajout d'une valeur d'enum lit une ligne qui la porte | `PrismaClientUnknownRequestError` sans code : « Value 'REFUNDED' not found in enum 'OrderStatus' », pour `findUnique` comme pour toute liste qui sélectionne la colonne (la liste entière échoue). Une requête qui ne sélectionne pas la colonne passe |
| L33 | Baseline sur une base dont `_prisma_migrations` contient déjà des lignes pour des dossiers disparus | `migrate deploy` lancé **avant** `migrate resolve --applied <baseline>` tente d'exécuter la baseline et échoue (`P3018`, `42710` « type "Role" already exists »). Après `migrate resolve --applied`, `migrate deploy` répond « No pending migrations » et `migrate status` « up to date » : les anciennes lignes sans dossier ne gênent pas |
| L34 | Un index unique construit par `CREATE UNIQUE INDEX CONCURRENTLY` sous le nom de Prisma (`order_items_order_id_product_id_variant_key`), puis `@@unique([orderId, productId, variant])` ajouté au schéma | `migrate diff --from-url` ne propose aucune instruction pour cette contrainte : Prisma reconnaît l'index existant |
| L35 | `ALTER TYPE … ADD VALUE` puis usage de la valeur dans la même transaction (PostgreSQL 15) | `ERROR: unsafe use of new value "…" of enum type "OrderStatus"` |

## SQL émis par Prisma

Journal `query` du client.

| Id | Appel | SQL observé |
|---|---|---|
| L12 | `dailyCounter.upsert` sur l'unique composé `shopId_date` ; `orderNumberCounter.upsert` sur sa clé `year`, dans une transaction interactive | **Une** instruction `INSERT … ON CONFLICT (…) DO UPDATE SET "last_number" = … + $n … RETURNING …`. 20 upserts simultanés : 20 numéros distincts, sans trou |
| L13 | `order.findMany` avec `include` de `items → product`, `user`, `priceAdjustment` | Une instruction par relation (`WHERE … IN (…)`), aucune jointure |
| L14 | `updateMany` gardé par `id`, `shopId`, `status` ; `updateManyAndReturn` | `UPDATE … WHERE id = $ AND shop_id = $ AND status = $` ; 5 appels simultanés : 1 seul `count` à 1. `updateManyAndReturn` rend les lignes écrites |
| L15 | `$queryRaw` avec `count(*)` et `sum(int)` | `bigint` en JavaScript ; `JSON.stringify` lève « Do not know how to serialize a BigInt ». Avec `::int` : `number`. `aggregate` et `groupBy` rendent `number` pour un champ `Int` |
| L36 | Forme des erreurs connues | `P2002` : `meta = { modelName: "Order", target: ["idempotency_key"] }` (noms de colonnes SQL ; `["shop_id","user_id"]` pour une clé composée). `update` ou `delete` d'une ligne absente : `P2025`, `meta.cause` = « No record was found for an update. » |
| L16 | `count({ where: { shopId: undefined } })` | Filtre **ignoré** : toutes les lignes de la table sont comptées. `{ shopId: null }` sur un champ obligatoire : `PrismaClientValidationError` |

## Concurrence

Chaque essai lance 5 à 20 appels simultanés avec `connection_limit=10`.

| Id | Scénario | Résultat |
|---|---|---|
| L17 | Créneau de capacité 5, 20 créations simultanées | Forme actuelle « `count` puis `create` » : **20 commandes réservées**. `pg_advisory_xact_lock` en tête de transaction : 5 (49 ms). `SELECT … FROM shops WHERE id = $ FOR UPDATE` : 5 (46 ms). `Serializable` sans nouvelle tentative : 3 réservées, 17 `P2034`. `Serializable` avec 5 tentatives : 5 |
| L18 | `tx.$queryRaw` sur `pg_advisory_xact_lock(…)` | `P2010` « Failed to deserialize column of type 'void' ». `tx.$executeRaw` fonctionne |
| L19 | Offre à `maxUses` 3, 10 consommations simultanées | Incrément inconditionnel (code actuel) : `currentUses` = 10. `updateMany` avec `currentUses: { lt: prisma.offer.fields.maxUses }` : 3 gagnants, `currentUses` = 3 |
| L20 | Récompense, 10 réclamations simultanées avec `usedAt: null` dans le `where` | 1 gagnant |
| L21 | `P2002` attrapée **dans** une transaction interactive, puis requête suivante | Erreur PostgreSQL `25P02` « current transaction is aborted », rendue sans code `P…` ; rien n'est écrit, y compris ce qui précédait l'erreur |
| L22 | Numéro client par boutique (`ShopCustomer`), 4 clients × 5 premières commandes simultanées | « Lire, incrémenter, créer » : 10 `P2002` sur 20. « Lire, incrémenter (verrou de ligne du compteur), **relire**, créer » : 20 succès, 4 lignes, un seul numéro par client, numéros avec trous (1, 2, 4, 9) |
| L23 | Tableau JSON `notif_sent`, 10 ajouts simultanés | Lecture puis réécriture (code actuel) : 1 entrée conservée sur 10. `UPDATE … SET notif_sent = coalesce(notif_sent,'[]') \|\| $::jsonb WHERE … AND NOT (… @> $::jsonb)` : 1 gagnant, 1 entrée |
| L24 | Deux lignes égales sur un `@@unique` composite dont une colonne nullable vaut `NULL` | Acceptées toutes les deux : l'index unique ne compare pas les `NULL` |
| L25 | Changement de statut gardé, 5 acceptations simultanées | 1 gagnant, 4 `count` à 0 |

Rejoués le **14/11/2026** sur le schéma de l'arbre de travail (identique à `prisma/schema.prisma` ce jour-là, PostgreSQL 15 local) :

| Id | Scénario | Résultat |
|---|---|---|
| L38 | Forme actuelle de `services/orders/shop-capacity.ts` (`count` hors transaction) puis création, créneau de 5, 20 appels simultanés ; puis même scénario avec `pg_advisory_xact_lock` en tête de transaction | 20 commandes acceptées ; avec le verrou : 5. `count({ where: { shopId: undefined } })` = nombre de lignes de toute la table (confirme L16) |
| L39 | Contrôle optimiste sans colonne `version` : 3 `shop.updateMany({ where: { id, updatedAt: <valeur lue> } })` simultanés | 1 seul `count` à 1 : `@updatedAt` sert de jeton de version pour une édition « lire, modifier, enregistrer » |

Contrôle indépendant du **14/11/2026** (vérificateur du skill ; conteneur `postgres:15-alpine` jetable, PostgreSQL 15.19, schéma de l'arbre de travail, client 6.19.2 généré hors du dépôt) :

| Id | Scénario | Résultat |
|---|---|---|
| L41 | Mesures rejouées | L1, L4, L6, L11, L12, L13, L15, L16, L17, L18, L21, L23, L24, L35, L36, L37, L38, L39 : mêmes résultats que ci-dessus (L17 : formes « `count` puis `create` » et verrou consultatif seulement ; L23 : forme en une instruction seulement ; L11 : la réécriture tient à la précision `(3)` — sans précision, `timestamp` → `timestamptz` en session `UTC` ne réécrit pas). Les autres mesures (L2, L3, L5, L7 à L10, L14, L19, L20, L22, L25 à L34) n'ont pas été rejouées par le vérificateur. Compléments : un `upsert` portant `include: { shop: true }` n'est **plus** une instruction unique (`BEGIN`, `SELECT`, `UPDATE`, `SELECT`, `COMMIT`). Une violation d'unicité levée par `$executeRaw` arrive en `P2010` avec `meta.code = "23505"`, pas en `P2002`. `updateMany({ …, limit: 1 })` émet `UPDATE … WHERE id IN (SELECT … LIMIT $n)` ; trois écritures gardées simultanées sur la même commande : 3 gagnantes dans 14 essais sur 15 avec `limit`, 1 gagnante dans 15 essais sur 15 sans. La liste par clé de `index-et-requetes.md` § 5 rend, page par page, exactement l'ordre complet sur 57 commandes à dates ex æquo |
| L42 | Procédure de `migrations.md` § 2 sur la migration du chantier 0 : `db push` du schéma de `HEAD`, `prisma db execute --file migration.sql`, puis `migrate diff --from-url … --to-schema-datamodel prisma/schema.prisma --exit-code` | « No difference detected », code de sortie 0. Le diff de schéma à schéma (étape 1) fonctionne sans aucune variable `DATABASE_URL` |

## Pool de connexions et transactions

| Id | Scénario | Résultat |
|---|---|---|
| L26 | `connection_limit=1&pool_timeout=3` | `prisma.` (et non `tx.`) dans le callback d'une transaction : `P2024` après 3 s (parce que `pool_timeout` est ici plus court que le `timeout` de la transaction : voir L40 pour les délais par défaut). `Promise.all` de 3 requêtes de 300 ms : 924 ms. Requête en file derrière une requête de 4 s : `P2024` après 3 s. Transaction qui dépasse son `timeout` de 1 s : `P2028`. Sans paramètre, le pool ouvre 17 connexions sur 8 cœurs (`2 × cœurs + 1`) |
| L40 | `prisma.` dans le callback d'une transaction interactive, `connection_limit=1`, `pool_timeout` par défaut (10 s) — vérificateur, 14/11/2026 | Transaction aux délais par défaut : la requête `prisma.` attend 5,0 s, la transaction expire (`P2028`, annulée), **puis la requête `prisma.` réussit, hors transaction**. Avec `{ maxWait: 5_000, timeout: 10_000 }` : même issue à 10,0 s. Avec `connection_limit=5` : aucune erreur, la requête `prisma.` s'exécute en 42 ms sur une autre connexion, hors transaction |

## Dates

| Id | Scénario | Résultat |
|---|---|---|
| L27 | Logique de `numbering.service.ts` (`new Date()` puis `setHours(0, 0, 0, 0)`) écrite dans la colonne `@db.Date` | Processus en `UTC` (Vercel) à 00:30 heure de Paris le 15 juillet : date stockée **14 juillet**. Processus en `Europe/Paris` à 10:00 le 14 juillet : date stockée **13 juillet**. Avec `new Date(Date.UTC(année, mois − 1, jour))` tirés de `getParisWallClock()` : date de Paris correcte dans les six cas essayés (été, hiver, deux fuseaux de processus) |
| L37 | Commande créée à `2026-07-14T22:30Z`, recherchée dans la fenêtre `[22:00Z, 23:00Z[` avec des `Date` en paramètres, session PostgreSQL en `UTC` puis en `Europe/Paris` (`?options=-c TimeZone=…`), rejoué le 14/11/2026 | Requête de modèle Prisma : trouvée dans les deux cas. `$queryRaw` avec `created_at >= ${from}` : trouvée en `UTC`, **pas trouvée** en `Europe/Paris`. `$queryRaw` avec `(${from}::timestamptz AT TIME ZONE 'UTC')` : trouvée dans les deux cas |

## Plans d'exécution

`EXPLAIN (ANALYZE, BUFFERS)` sur le jeu de volume, cache chaud. Base poussée depuis le schéma muni des lignes de L3.

| Id | Requête | Plan et durée |
|---|---|---|
| L28a | Liste cuisine : `shop_id = $ ORDER BY created_at DESC LIMIT 50` | Parcours arrière de `orders_shop_id_created_at_idx`, 0,13 ms |
| L28b | Commandes actives d'une boutique (`status IN (…)`) | `orders_shop_id_status_idx`, 0,08 ms |
| L28c | Commandes d'un client triées par date | `orders_user_id_status_idx` puis tri de 60 lignes, 0,35 ms |
| L28d | Occupation d'un créneau | `orders_shop_id_pickup_slot_start_idx`, 0,07 ms |
| L28e | Balayage des expirées : `status = 'PENDING' AND expires_at <= $` | `orders_status_expires_at_idx`, 0,04 ms |
| L28f | `max(updated_at)` d'une boutique (requête de la sonde de version prévue, pas encore dans le code) | Parcours d'index seul sur `orders_shop_id_updated_at_idx`, 0,11 ms |
| L28g | Page profonde sur toute la table : `ORDER BY created_at DESC LIMIT 20 OFFSET 200000` | 200 020 lignes lues, 5 310 blocs, **50,7 ms** ; la même page par comparaison de ligne `(created_at, id) < ($, $)` : 7 blocs, **0,11 ms** |
| L28h | `count(*)` de toute la table (total d'une liste admin) | Parcours parallèle d'un index entier, 12,2 ms |
| L28i | Chiffre du mois d'une boutique (`shop_id`, `paid_at`) | Avec `orders_shop_id_paid_at_idx` : 0,56 ms. Sans : 6 000 lignes lues, 5,2 ms |
| L28j | Chiffre du mois de **toutes** les boutiques en une requête groupée | Parcours séquentiel, 19,6 ms ; par `prisma.order.groupBy` : 24 ms aller-retour compris |
| L28k | Recherche `name ILIKE '%kefta 1999%'` sur 20 000 produits | Avec l'index trigramme : 0,8 ms. Sans : parcours séquentiel, 10,0 ms |
| L29 | 20 commandes d'une boutique à 4 500 lignes de profondeur, tri `(createdAt desc, id desc)`, quatre écritures Prisma | `skip: 4500` : 5 141 blocs, 6,9 ms. `cursor: { id }, skip: 1` : 3 916 blocs, 2,8 ms, **4 500 lignes écartées par filtre** (Prisma émet un `OR` sur trois sous-requêtes, non borné par l'index). `where` par clé en `OR` seul : 3 904 blocs, 3,6 ms, 4 501 lignes écartées. `where` par clé avec **borne `createdAt: { lte }`** + `OR` de départage : **24 blocs, 0,10 ms**, 1 ligne écartée. Les quatre rendent la même page. Avec un tri sur une seule colonne, le curseur natif est borné par l'index |
| L30 | `DELETE` d'un produit jamais commandé | Sans index sur `order_items(product_id)` : 45,5 ms dont 43,2 ms dans le contrôle de clé étrangère. Avec l'index (5,2 Mo) : 2,8 ms dont 0,3 ms. — `orders` porte 17 index (14 issus du schéma, 3 du SQL) : 85 Mo d'index pour 44 Mo de table. — Index partiel `(expires_at) WHERE status = 'PENDING'` : 16 ko contre 1,9 Mo, utilisé par une requête préparée à paramètres (plans personnalisés), **ignoré** sous `plan_cache_mode = force_generic_plan` |

## Compilation des extraits

| Id | Vérification | Résultat |
|---|---|---|
| L31 | Les extraits TypeScript du skill (liste par clé, écritures conditionnelles, compteurs, `ShopCustomer`, verrou de créneau, nouvelle tentative, agrégats, parcours par lots, ajout JSON, `omit`, test de `P2002`), compilés par le `tsc` du dépôt avec les options de `tsconfig.json` (`strict`, cible `es2017`) et le client généré depuis le schéma de l'arbre de travail | 0 erreur. Contrôle négatif : `relationLoadStrategy` est refusé (`TS2322`, la préversion `relationJoins` n'est pas activée). L'agrégat SQL par jour de Paris et `omit` ont aussi été exécutés |

## Refaire une vérification

Base jetable (rien n'est conservé à l'arrêt) et schéma copié hors du dépôt, pour que la CLI ne trouve aucun `.env` :

```bash
docker run -d --rm --name kg-lab -e POSTGRES_USER=kg -e POSTGRES_PASSWORD=kg -e POSTGRES_DB=kg \
  -p 127.0.0.1:55440:5432 --tmpfs /var/lib/postgresql/data postgres:16-alpine
LAB="$(mktemp -d)" && cp -R prisma "$LAB/prisma" && ln -s "$PWD/node_modules" "$LAB/node_modules" && echo "$LAB"
# Chaque commande Prisma : dossier de travail + les DEUX URL littérales, sur la même ligne
( cd "$LAB" && DATABASE_URL="postgresql://kg:kg@127.0.0.1:55440/kg" DIRECT_DATABASE_URL="postgresql://kg:kg@127.0.0.1:55440/kg" \
    ./node_modules/.bin/prisma db push --skip-generate )   # schéma courant, sans historique
docker stop kg-lab                                         # en fin de séance
```

Règles :

- Les variables d'environnement ne survivent pas d'un appel Bash à l'autre : écrire **les deux** URL, en valeur littérale `127.0.0.1`, devant chaque commande Prisma. Ne jamais compter sur une `DATABASE_URL` héritée de la session.
- `db push` (sans perte de données détectée) et `db seed` s'exécutent **sans confirmation** : la ligne « Datasource "db": … at "127.0.0.1:55440" » se contrôle après coup, elle ne protège de rien. `migrate reset` (et `migrate dev`, de toute façon inutilisable ici [L1]) ne se lancent que sur cette base jetable.
- `psql` n'est pas installé sur le poste : `docker exec -i kg-lab psql -U kg -d kg`, ou `prisma db execute --url … --file …`.
- Pour observer le SQL émis : `new PrismaClient({ log: [{ emit: "event", level: "query" }] })` dans un script de travail, jamais dans `src/lib/prisma.ts`.
- Pour un client typé sur un schéma modifié sans toucher `node_modules` : ajouter `output = "../gen/client"` au générateur de la **copie**, puis `prisma generate` dans le dossier de travail.
- Tests d'intégration du dépôt sur cette base : `DATABASE_URL="postgresql://kg:kg@127.0.0.1:55440/kg" npm run test:integration` (ils créent et vident le schéma `itest`, et refusent tout hôte non local).
