-- Lecture seule (Prisma ignore ce fichier) : nombre de commandes que backfill-after-release.sql
-- modifierait. À lancer avant lui, par exemple dans l'onglet de requêtes de Railway.
SELECT count(*) AS orders_to_backfill
FROM "orders" o
JOIN "users" u ON u."id" = o."user_id"
WHERE u."is_guest" = true
  AND u."guest_token" IS NOT NULL
  AND o."access_token_hash" IS NULL;
