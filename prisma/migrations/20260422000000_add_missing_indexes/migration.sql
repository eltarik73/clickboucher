-- Add missing indexes for hot cron paths
-- Generated manually (DB not reachable at dev time). Will be applied by
-- `prisma migrate deploy` on the next deployment.

-- Orders: PENDING + expiresAt scan (auto-cancel cron)
CREATE INDEX IF NOT EXISTS "orders_status_expires_at_idx" ON "orders" ("status", "expires_at");

-- Carts: abandoned cart scan
CREATE INDEX IF NOT EXISTS "carts_abandoned_at_idx" ON "carts" ("abandoned_at");
