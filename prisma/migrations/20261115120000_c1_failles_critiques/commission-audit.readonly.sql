-- LECTURE SEULE (Prisma ignore ce fichier) : contrôle d'abus sur la commission de la plateforme.
-- Une seule requête SELECT, aucune écriture. À lancer par le propriétaire de Klik&Go sur la base de
-- production, JAMAIS par un agent :
--   PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" \
--     -f prisma/migrations/20261115120000_c1_failles_critiques/commission-audit.readonly.sql
-- ou en la collant dans l'onglet de requêtes de Railway. `npx prisma db execute --file` l'exécute
-- aussi, mais n'affiche pas les lignes : préférer psql ou Railway pour lire le résultat.
--
-- Pourquoi : jusqu'à C1-FAILLES-CRITIQUES, PATCH /api/shops/[id] laissait le boucher propriétaire
-- écrire shops.commission_pct. Les seuls auteurs légitimes du taux sont désormais
-- PATCH /api/admin/shops/[shopId]/commission (journal 'shop.commission_change', tracé depuis
-- toujours) et PATCH /api/admin/commission/global (journal 'commission.global_change', tracé depuis
-- ce chantier ; une décision globale vaut pour les boutiques qui existaient à cette date).
--
-- Chaque ligne rendue est une boutique dont le taux actuel :
--   - 'aucune décision admin tracée (attendu 0)' : n'est pas 0 alors qu'aucune décision admin n'est
--     tracée pour elle ;
--   - 'diffère de la dernière décision admin' : ne vaut pas la dernière décision admin tracée.
--
-- Causes innocentes connues (faux positifs), à écarter avant de conclure à un abus :
--   1. taux fixé à la création par un administrateur (POST /api/shops, formulaire de /admin/shops) :
--      jamais tracé ;
--   2. taux modifié par un administrateur dans l'ancienne fenêtre d'édition de /admin/shops
--      (PATCH /api/shops/[id]) : non tracé avant ce chantier ;
--   3. bouton de commission globale utilisé avant ce chantier (PATCH /api/admin/commission/global) :
--      non tracé avant ce chantier ;
--   4. écriture du journal d'audit qui aurait échoué (writeAuditLog journalise l'erreur sans faire
--      échouer la requête).
-- Pour un abus avéré : remettre le taux depuis /webmaster/boutiques/<id> (tracé), puis comparer le
-- commission_cents des commandes de la période.
WITH admin_decision AS (
    SELECT a."target_id" AS "shop_id",
           (a."details" ->> 'commissionPct')::float8 AS "commission_pct",
           a."created_at",
           a."id"
    FROM "audit_logs" AS a
    WHERE a."action" = 'shop.commission_change'
      AND a."target" = 'Shop'
      AND a."target_id" IS NOT NULL
      AND a."details" ? 'commissionPct'
    UNION ALL
    SELECT s."id" AS "shop_id",
           (g."details" ->> 'commissionPct')::float8 AS "commission_pct",
           g."created_at",
           g."id"
    FROM "audit_logs" AS g
    JOIN "shops" AS s ON s."created_at" <= g."created_at"
    WHERE g."action" = 'commission.global_change'
      AND g."details" ? 'commissionPct'
),
last_change AS (
    SELECT DISTINCT ON (d."shop_id")
           d."shop_id",
           d."commission_pct",
           d."created_at"
    FROM admin_decision AS d
    ORDER BY d."shop_id", d."created_at" DESC, d."id" DESC
)
SELECT s."id",
       s."slug",
       s."name",
       s."commission_pct",
       s."commission_enabled",
       lc."commission_pct" AS "derniere_decision_admin_pct",
       lc."created_at" AS "derniere_decision_admin_le",
       s."updated_at",
       CASE
           WHEN lc."shop_id" IS NULL THEN 'aucune décision admin tracée (attendu 0)'
           ELSE 'diffère de la dernière décision admin'
       END AS "constat"
FROM "shops" AS s
LEFT JOIN last_change AS lc ON lc."shop_id" = s."id"
WHERE (lc."shop_id" IS NULL AND s."commission_pct" <> 0)
   OR (lc."shop_id" IS NOT NULL AND s."commission_pct" IS DISTINCT FROM lc."commission_pct")
ORDER BY s."updated_at" DESC, s."id";
