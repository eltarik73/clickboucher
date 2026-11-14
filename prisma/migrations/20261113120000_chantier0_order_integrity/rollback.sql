-- Retour arrière du SCHÉMA du chantier 0 (Prisma ignore ce fichier : il ne lit que migration.sql).
--
-- Retour arrière normal : redéployer le build précédent et NE PAS exécuter ce fichier. Le schéma
-- reste en place, le code d'avant le chantier 0 n'utilise aucun de ces objets.
--
-- À n'exécuter que si le schéma lui-même doit disparaître, et seulement une fois le code d'avant
-- le chantier 0 redéployé (le code du chantier 0 ne fonctionne pas sans ces objets) :
--   npx prisma db execute --url "$DIRECT_DATABASE_URL" \
--     --file prisma/migrations/20261113120000_chantier0_order_integrity/rollback.sql
--
-- Perte assumée : les numéros client par boutique attribués depuis la migration (table
-- shop_customers et colonne orders.customer_number). Les commandes et leurs numéros « KG26-… »
-- sont conservés ; si la migration est rejouée plus tard, elle recalcule les compteurs de numéros
-- de commande à partir de ces commandes.
-- customer_counters : les valeurs relevées restent (le code précédent ne fait qu'incrémenter).
--
-- Tout ou rien : une seule transaction, rejouable sans effet.

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "orders" ALTER COLUMN "service_fee_cents" SET DEFAULT 99;
ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_number";
DROP TABLE IF EXISTS "shop_customers";
DROP TABLE IF EXISTS "order_number_counters";

-- L'historique Prisma suit le schéma : sans cette ligne, un futur déploiement du chantier 0
-- croirait la migration déjà appliquée et ne recréerait pas les objets supprimés ci-dessus.
-- (`prisma migrate resolve --rolled-back` ne convient pas ici : il n'accepte qu'une migration
-- en échec, erreur P3012 sur une migration appliquée.)
DO $$
BEGIN
    IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
        DELETE FROM "_prisma_migrations"
        WHERE "migration_name" = '20261113120000_chantier0_order_integrity';
    END IF;
END $$;

COMMIT;
