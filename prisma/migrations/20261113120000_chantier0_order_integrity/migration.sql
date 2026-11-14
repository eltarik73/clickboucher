-- Chantier 0 — Intégrité des commandes.
-- Additif uniquement : aucune colonne existante n'est supprimée, renommée ni réécrite.
-- Le code précédent (2364ef9) continue de fonctionner sur ce schéma pendant le déploiement
-- et après un retour arrière applicatif.
--
-- Chaque instruction est rejouable (IF NOT EXISTS, ON CONFLICT, IS NULL) et
-- `prisma migrate deploy` exécute ce fichier dans une seule transaction : un échec n'applique rien.
-- Après un échec (verrou non obtenu en 5 s, par exemple), Prisma refuse tout nouveau déploiement
-- (P3009) tant que la migration n'est pas déclarée annulée :
--   npx prisma migrate resolve --rolled-back 20261113120000_chantier0_order_integrity
-- Le déploiement suivant la rejoue alors entièrement. Retour arrière du schéma : rollback.sql.
-- Avant `migrate deploy`, le build de production exécute preflight.sql (lecture seule) : s'il manque
-- une précondition, le build s'arrête sans que rien ne soit appliqué ni inscrit dans _prisma_migrations.

SET lock_timeout = '5s';

-- 1) Compteur des numéros de commande : une ligne par année (heure de Paris).
CREATE TABLE IF NOT EXISTS "order_number_counters" (
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("year")
);

-- Reprise de la numérotation après le plus grand numéro déjà attribué dans l'année, quel que
-- soit son format :
--   « KG-AAAA-NNNNN » : numéros du code précédent ;
--   « KGAA-NNNNNN »   : numéros du chantier 0. Il n'y en a aucun à la première application ;
--                       il y en a si la migration est rejouée après rollback.sql, et repartir
--                       en dessous d'eux bloquerait la création de commande sur un doublon.
INSERT INTO "order_number_counters" ("year", "last_number")
SELECT issued."year", MAX(issued."number")
FROM (
    SELECT substring("order_number" from '^KG-([0-9]{4})-[0-9]+$')::INTEGER AS "year",
           substring("order_number" from '^KG-[0-9]{4}-([0-9]+)$')::INTEGER AS "number"
    FROM "orders"
    WHERE "order_number" ~ '^KG-[0-9]{4}-[0-9]{1,9}$'
    UNION ALL
    SELECT 2000 + substring("order_number" from '^KG([0-9]{2})-[0-9]+$')::INTEGER,
           substring("order_number" from '^KG[0-9]{2}-([0-9]+)$')::INTEGER
    FROM "orders"
    WHERE "order_number" ~ '^KG[0-9]{2}-[0-9]{6,9}$'
) issued
GROUP BY issued."year"
ON CONFLICT ("year") DO UPDATE
    SET "last_number" = GREATEST("order_number_counters"."last_number", EXCLUDED."last_number");

-- 2) Numéro client par boutique : un client a un numéro par boutique, unique dans la boutique.
CREATE TABLE IF NOT EXISTS "shop_customers" (
    "shop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_customers_pkey" PRIMARY KEY ("shop_id", "user_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_customers_shop_id_number_key" ON "shop_customers"("shop_id", "number");

-- Clés étrangères : la recherche est limitée à CETTE table (conrelid), un nom de contrainte
-- n'étant unique que par table ; une table homonyme dans un autre schéma ne doit pas la fausser.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'shop_customers_shop_id_fkey' AND conrelid = '"shop_customers"'::regclass
    ) THEN
        ALTER TABLE "shop_customers" ADD CONSTRAINT "shop_customers_shop_id_fkey"
            FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'shop_customers_user_id_fkey' AND conrelid = '"shop_customers"'::regclass
    ) THEN
        ALTER TABLE "shop_customers" ADD CONSTRAINT "shop_customers_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Reprise : chaque client garde, dans chaque boutique où il a commandé, le numéro affiché
-- jusqu'ici (users.customer_number est unique sur toute la plateforme, donc unique par boutique).
INSERT INTO "shop_customers" ("shop_id", "user_id", "number")
SELECT DISTINCT o."shop_id", o."user_id", substring(u."customer_number" from '^C-([0-9]+)$')::INTEGER
FROM "orders" o
JOIN "users" u ON u."id" = o."user_id"
WHERE u."customer_number" ~ '^C-[0-9]{1,9}$'
ON CONFLICT DO NOTHING;

-- Les compteurs par boutique repartent au-dessus de tout numéro repris. Jamais abaissés :
-- le code précédent incrémente les mêmes lignes.
INSERT INTO "customer_counters" ("id", "shop_id", "last_number")
SELECT 'cc_' || md5(sc."shop_id"), sc."shop_id", MAX(sc."number")
FROM "shop_customers" sc
GROUP BY sc."shop_id"
ON CONFLICT ("shop_id") DO UPDATE
    SET "last_number" = GREATEST("customer_counters"."last_number", EXCLUDED."last_number");

-- 3) Commande : numéro client figé à la création, et frais de service réels.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_number" INTEGER;

UPDATE "orders" o
SET "customer_number" = sc."number"
FROM "shop_customers" sc
WHERE sc."shop_id" = o."shop_id"
  AND sc."user_id" = o."user_id"
  AND o."customer_number" IS NULL;

-- Aucune commande payée sur place ne porte de frais de service : la valeur par défaut 99
-- inscrivait un montant jamais encaissé. Les lignes existantes ne sont pas modifiées.
-- Le client Prisma envoie lui-même la valeur par défaut de SON schéma : le code précédent
-- continue donc d'écrire 99 tant qu'il sert des requêtes (déploiement, retour arrière) ;
-- le nouveau code et les insertions SQL directes obtiennent 0.
ALTER TABLE "orders" ALTER COLUMN "service_fee_cents" SET DEFAULT 0;
