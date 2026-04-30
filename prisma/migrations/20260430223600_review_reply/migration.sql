-- Add boucher reply to reviews — lets shop owner respond publicly to customer reviews.
ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "reply" TEXT,
  ADD COLUMN IF NOT EXISTS "replied_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replied_by_id" TEXT;
