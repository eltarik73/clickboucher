-- Retour arrière du SCHÉMA de C1-INVITES (Prisma ignore ce fichier : il ne lit que migration.sql).
--
-- À n'exécuter qu'APRÈS avoir redéployé le code d'avant C1-INVITES : le code de C1-INVITES ne
-- fonctionne pas sans ces cinq colonnes.
--   npx prisma db execute --url "$DIRECT_DATABASE_URL" \
--     --file prisma/migrations/20261114120000_c1_invites/rollback.sql
--
-- Perte assumée : tous les jetons d'accès par commande (les invités perdent leurs liens de suivi)
-- et l'identité saisie par chaque invité (le ticket et le suivi reprennent la ligne users).
-- Les anciens jetons par personne (users.guest_token) ne sont pas touchés : le code précédent les
-- relit.
-- ATTENTION : revenir au code précédent, avec ou sans ce fichier, rouvre le défaut A01-02 (le code
-- précédent remet le jeton par personne à quiconque commande avec le même e-mail).
--
-- Tout ou rien : une seule transaction, rejouable sans effet.

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "orders" DROP COLUMN IF EXISTS "access_token_hash";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "placed_as_guest";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_first_name";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_last_name";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_phone";

-- L'historique Prisma suit le schéma : sans cette ligne, un futur déploiement de C1-INVITES
-- croirait la migration déjà appliquée et ne recréerait pas les colonnes supprimées ci-dessus.
-- (`prisma migrate resolve --rolled-back` ne convient pas ici : il n'accepte qu'une migration
-- en échec, erreur P3012 sur une migration appliquée.)
DO $$
BEGIN
    IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
        DELETE FROM "_prisma_migrations"
        WHERE "migration_name" = '20261114120000_c1_invites';
    END IF;
END $$;

COMMIT;
