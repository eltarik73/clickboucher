-- Audit CTO #1 perf 2026-05-09 : index pour le cron qui bascule les
-- commandes programmées en "À préparer maintenant" 30 min avant pickupSlotStart.
-- Sans cet index, full scan Order toutes les 5 min sur la page Mode Cuisine.
CREATE INDEX IF NOT EXISTS "orders_shop_id_pickup_slot_start_idx"
  ON "orders"("shop_id", "pickup_slot_start");
