-- Stripe foundations migration — schema only, no data, no behavior change.
-- The application reads STRIPE_SECRET_KEY at runtime; while it is unset,
-- isStripeConfigured() stays false and these columns/tables remain unused.

-- 1) Stripe Connect Express fields on Shop
ALTER TABLE "shops"
  ADD COLUMN     "stripe_account_id"       TEXT,
  ADD COLUMN     "stripe_account_status"   TEXT,
  ADD COLUMN     "stripe_charges_enabled"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "stripe_payouts_enabled"  BOOLEAN NOT NULL DEFAULT false;

-- 2) Webhook idempotency table
CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id"            TEXT       NOT NULL,
  "type"          TEXT       NOT NULL,
  "processed_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload"       JSONB,
  CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);
