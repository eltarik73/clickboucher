-- Rattrapage après la mise en production de C1-FAILLES-CRITIQUES (Prisma ignore ce fichier). À
-- lancer par le propriétaire, une fois le nouveau déploiement actif, après
-- backfill-after-release.dry-run.sql, avec psql ou dans l'onglet de requêtes de Railway (qui
-- affichent les boutiques modifiées) :
--   psql "$DIRECT_DATABASE_URL" -f prisma/migrations/20261115120000_c1_failles_critiques/backfill-after-release.sql
--
-- Pourquoi : le code précédent suspendait une boutique sans remplir shops.suspended_at (il la
-- masquait, la fermait et écrivait le motif dans closed_message, et la route admin inscrivait
-- 'shop.suspend' au journal d'audit). Le nouveau code ne reconnaît une suspension qu'à
-- suspended_at : jusqu'à ce rattrapage, ces boutiques restent masquées, sans page et sans commande,
-- mais l'administration les voit « non validées » au lieu de « suspendues ». À lancer sans attendre :
-- d'ici là, un clic sur « Valider » remettrait une de ces boutiques en ligne.
--
-- Ce qu'il fait, pour chaque boutique dont la DERNIÈRE décision de suspension ou de réactivation
-- au journal d'audit est une suspension, encore masquée (visible = false) et sans suspended_at :
--   - suspended_at = date de cette décision ; suspend_reason = son motif, sinon un motif générique ;
--   - closed_message est vidé s'il contient exactement ce que le code précédent y avait écrit à la
--     suspension (le motif, sinon « Boutique suspendue par l'administration ») : ce message est
--     celui du boucher, et la réactivation par le nouveau code ne le touche plus. Un message
--     réécrit depuis par le boucher est gardé.
-- Une boutique de nouveau listée malgré sa suspension n'est pas touchée (voir le fichier dry-run).
--
-- Une seule instruction, donc une seule transaction : tout ou rien. Rejouable : une boutique qui a
-- déjà suspended_at n'est jamais modifiée, un second passage ne modifie rien. Exécutée telle quelle
-- par tests/integration/security/shop-suspension-backfill.test.ts.
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
UPDATE "shops" AS s
SET "suspended_at" = m."created_at",
    "suspend_reason" = COALESCE(m."reason", 'Suspendue par l''administration'),
    "closed_message" = CASE
        WHEN s."closed_message" = COALESCE(m."reason", 'Boutique suspendue par l''administration')
            THEN NULL
        ELSE s."closed_message"
    END
FROM last_moderation AS m
WHERE m."shop_id" = s."id"
  AND m."action" = 'shop.suspend'
  AND s."visible" = false
  AND s."suspended_at" IS NULL
RETURNING s."id", s."slug", s."name", s."suspended_at", s."suspend_reason", s."closed_message";
