-- Audit Phase 1 — fixes critiques Stripe Connect
--
-- 1) C4 : `monthly_gmv_cents` Int32 → BigInt (overflow garanti à terme).
--    Standard de l'industrie : tous les compteurs monétaires cumulatifs en BIGINT.
--    Int32 max = 2 147 483 647 cents = 21,4 M€ — atteignable par cumul B2B sur traiteurs.
--
-- 2) C3 : `orders.refunded_platform_fee_cents` — montant de la commission Klik&Go
--    proportionnellement remboursé au boucher lors d'un refund partiel.
--    Permet le reporting fiscal correct (commission encaissée nette de refund).

-- ── 1) Shop : monthly_gmv_cents Int → BigInt ──
ALTER TABLE "shops"
  ALTER COLUMN "monthly_gmv_cents" TYPE BIGINT USING "monthly_gmv_cents"::BIGINT;

-- ── 2) Order : refunded_platform_fee_cents ──
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "refunded_platform_fee_cents" INTEGER NOT NULL DEFAULT 0;
