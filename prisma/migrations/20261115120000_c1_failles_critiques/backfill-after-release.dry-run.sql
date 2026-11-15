-- Lecture seule (Prisma ignore ce fichier) : boutiques que backfill-after-release.sql marquerait
-- suspendues, et ce qu'il écrirait. À lancer avant lui, par exemple dans l'onglet de requêtes de
-- Railway. Même sélection que backfill-after-release.sql (voir son en-tête) ; une seule requête,
-- exécutée telle quelle par tests/integration/security/shop-suspension-backfill.test.ts.
--
-- N'apparaissent PAS ici, volontairement : les boutiques dont la dernière décision est une
-- suspension mais qui sont de nouveau listées (visible = true), remises en ligne par leur
-- propriétaire malgré la suspension (le trou que C1-FAILLES-CRITIQUES ferme). Les masquer est une
-- décision du propriétaire de Klik&Go, que ce rattrapage ne prend pas.
WITH last_moderation AS (
    SELECT DISTINCT ON (a."target_id")
           a."target_id" AS "shop_id",
           a."action",
           a."created_at",
           NULLIF(a."details" ->> 'reason', '') AS "reason"
    FROM "audit_logs" AS a
    WHERE a."target" = 'Shop'
      AND a."action" IN ('shop.suspend', 'shop.reactivate')
      AND a."target_id" IS NOT NULL
    ORDER BY a."target_id", a."created_at" DESC, a."id" DESC
)
SELECT s."id",
       s."slug",
       s."name",
       m."created_at" AS "suspended_at",
       m."reason" AS "audit_reason",
       COALESCE(m."reason", 'Suspendue par l''administration') AS "suspend_reason",
       s."closed_message",
       s."closed_message" IS NOT DISTINCT FROM
           COALESCE(m."reason", 'Boutique suspendue par l''administration') AS "closed_message_cleared"
FROM "shops" AS s
JOIN last_moderation AS m ON m."shop_id" = s."id"
WHERE m."action" = 'shop.suspend'
  AND s."visible" = false
  AND s."suspended_at" IS NULL
ORDER BY m."created_at", s."id";
