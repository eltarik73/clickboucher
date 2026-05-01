-- Backfill: legacy products had `boutiquePriceCents = NULL` because the markup feature
-- shipped after they were created. Without a boutique reference price, the boucher
-- cannot change markup % and have prices recalculate. Solution: treat the current
-- online price as the boutique price (markup effectively absorbed = 0).
--
-- Step 2: any shop that needed step 1 had NO products with a real boutique reference,
-- so `commission_markup_percent` was never actually applied. Reset to 0 so the UI
-- shows a coherent state ("boutique = online, markup 0 %"). The boucher can opt in
-- to 30/50/80/100 % later via the product form, which then recomputes online prices.

-- Step 1 prep: snapshot which shops had any product with NULL boutique price.
-- (Run before the actual backfill so we know which shops to reset.)
DO $$
DECLARE
  shop_ids text[];
BEGIN
  SELECT array_agg(DISTINCT shop_id) INTO shop_ids
  FROM "products"
  WHERE "boutique_price_cents" IS NULL AND "is_active" = true;

  -- Step 1: backfill product boutique price from current online price.
  UPDATE "products"
  SET "boutique_price_cents" = "price_cents"
  WHERE "boutique_price_cents" IS NULL
    AND "price_cents" > 0;

  -- Step 2: reset markup to 0 for these shops (markup was a seed default, never applied).
  IF shop_ids IS NOT NULL THEN
    UPDATE "shops"
    SET "commission_markup_percent" = 0
    WHERE "id" = ANY(shop_ids);
  END IF;
END $$;
