-- Retour arrière du SCHÉMA de C1-FAILLES-CRITIQUES (Prisma ignore ce fichier : il ne lit que
-- migration.sql).
--
-- À n'exécuter qu'APRÈS avoir redéployé le code d'avant C1-FAILLES-CRITIQUES, avec psql ou dans
-- l'onglet de requêtes de Railway, pour voir la liste du §1 :
--   psql "$DIRECT_DATABASE_URL" -f prisma/migrations/20261115120000_c1_failles_critiques/rollback.sql
-- (`npx prisma db execute --file …` l'exécute aussi, mais n'affiche pas cette liste.)
--
-- Les trois colonnes ne sont PAS supprimées : elles peuvent être antérieures à cette migration (bases
-- nées de `prisma db push`), et le schéma Prisma du code précédent les déclare : son client les nomme
-- dans chaque lecture de boutique faite sans `select`, les supprimer casserait le code précédent.
--
-- Tout ou rien : une seule transaction, rejouable sans effet.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1) Boutiques suspendues par le nouveau code (lecture seule : rien n'est modifié ici).
--    Avec le code précédent, chacune reste masquée et fermée (visible = false, status = 'CLOSED'),
--    exactement comme une suspension faite par ce code-là. Mais le code précédent laisse son
--    propriétaire la remettre en ligne (« reprendre », fin de congés, liste de démarrage du
--    tableau de bord boucher) : c'est le trou que ce chantier ferme, il se rouvre avec le retour
--    arrière.
--    suspended_at et suspend_reason restent remplis : le code précédent ne les lit pas pour
--    décider, et son bouton « Réactiver » ne les vide pas. AVANT de redéployer
--    C1-FAILLES-CRITIQUES, vider suspended_at et suspend_reason des boutiques réactivées entre-temps
--    (son preflight.sql compte, sans bloquer, les boutiques listées dont suspended_at est rempli) :
--    sinon le nouveau code les traiterait de nouveau comme suspendues.
SELECT "id", "slug", "name", "visible", "status", "suspended_at", "suspend_reason"
FROM "shops"
WHERE "suspended_at" IS NOT NULL
ORDER BY "suspended_at", "id";

-- 2) L'historique Prisma suit le schéma : sans cette ligne, `_prisma_migrations` dirait la
--    migration appliquée alors que le code déployé l'ignore, et un futur déploiement de
--    C1-FAILLES-CRITIQUES ne la rejouerait pas (elle ne fait qu'ajouter « si absentes » les trois
--    colonnes : la rejouer ne change rien si elles sont là).
--    (`prisma migrate resolve --rolled-back` ne convient pas ici : il n'accepte qu'une migration
--    en échec, erreur P3012 sur une migration appliquée.)
DO $$
BEGIN
    IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
        DELETE FROM "_prisma_migrations"
        WHERE "migration_name" = '20261115120000_c1_failles_critiques';
    END IF;
END $$;

COMMIT;
