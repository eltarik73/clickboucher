-- Rattrapage après la mise en production de C1-INVITES (Prisma ignore ce fichier). À lancer par le
-- propriétaire, une fois le nouveau déploiement actif, après backfill-after-release.dry-run.sql :
--   npx prisma db execute --url "$DIRECT_DATABASE_URL" \
--     --file prisma/migrations/20261114120000_c1_invites/backfill-after-release.sql
-- (ou coller l'instruction dans l'onglet de requêtes de Railway).
--
-- Pourquoi : migration.sql s'exécute au build, pendant que le code précédent sert encore les
-- requêtes. Une commande invitée créée par ce code entre la migration et la bascule n'a pas
-- d'empreinte : son auteur ne pourrait plus l'ouvrir. Cette instruction lui donne la même empreinte
-- que migration.sql (§3) a donnée aux commandes plus anciennes.
--
-- Rejouable : une commande qui a déjà une empreinte n'est jamais modifiée. Une seule instruction,
-- exécutée telle quelle par tests/integration/order-access.test.ts.
UPDATE "orders" AS o
SET "placed_as_guest" = true,
    "access_token_hash" = encode(sha256(convert_to(u."guest_token", 'UTF8')), 'hex')
FROM "users" AS u
WHERE u."id" = o."user_id"
  AND u."is_guest" = true
  AND u."guest_token" IS NOT NULL
  AND o."access_token_hash" IS NULL;
