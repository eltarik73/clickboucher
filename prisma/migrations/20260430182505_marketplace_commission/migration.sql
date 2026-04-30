-- Marketplace commission migration — adds tier-based commission, markup pricing,
-- and per-order fee breakdown for Stripe Connect destination charges.
--
-- Stripe is now activated (STRIPE_SECRET_KEY set). These columns are filled
-- by the new checkout flow (createCheckoutSession + webhook handlers) and
-- the boucher onboarding routes.

-- ── 1) Enum ShopTier ──
DO $$ BEGIN
  CREATE TYPE "ShopTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── 2) Shop — tier + markup config + early adopter ──
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "tier" "ShopTier" NOT NULL DEFAULT 'BRONZE',
  ADD COLUMN IF NOT EXISTS "commission_markup_percent" INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS "price_rounding_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "monthly_gmv_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "early_adopter_until" TIMESTAMP(3);

-- ── 3) Product — boutique price (mandatory in store, not yet enforced for legacy data) ──
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "boutique_price_cents" INTEGER;

-- ── 4) Order — fee breakdown + Stripe Checkout/PI/Transfer references ──
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "platform_fee_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "service_fee_cents" INTEGER NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS "stripe_fee_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shop_payout_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_transfer_id" TEXT;

-- ── 5) Indexes for analytics (finances dashboard, monthly GMV recompute) ──
CREATE INDEX IF NOT EXISTS "orders_shop_id_paid_at_idx" ON "orders" ("shop_id", "paid_at");
CREATE INDEX IF NOT EXISTS "orders_stripe_payment_intent_id_idx" ON "orders" ("stripe_payment_intent_id");
CREATE INDEX IF NOT EXISTS "orders_stripe_checkout_session_id_idx" ON "orders" ("stripe_checkout_session_id");
