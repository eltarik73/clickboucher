-- ═══════════════════════════════════════════════════════════
-- Guest checkout (Baymard +23% conversion)
-- Allows visitors to checkout without creating a Clerk account.
-- A "shadow" User row is created with clerkId=null + guestToken.
-- The guest can later sign up; the Clerk webhook merges by email.
-- ═══════════════════════════════════════════════════════════

-- 1) Make clerk_id nullable so we can create guest users without Clerk.
--    Postgres treats NULL as distinct in UNIQUE indexes, so multiple
--    guests with clerk_id=NULL won't collide.
ALTER TABLE "users" ALTER COLUMN "clerk_id" DROP NOT NULL;

-- 2) Add guest fields.
ALTER TABLE "users" ADD COLUMN "is_guest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "guest_token" TEXT;

-- 3) Unique index on guest_token (NULL allowed, multiple NULLs OK in PG).
CREATE UNIQUE INDEX "users_guest_token_key" ON "users"("guest_token");
