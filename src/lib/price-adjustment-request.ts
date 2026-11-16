// src/lib/price-adjustment-request.ts — the body of PATCH /api/orders/[id]/adjust-price: parsed by
// the server, built by the butcher's window, and planned by both with planAdjustment
// (src/lib/pricing/adjustment.ts).
//
// Client-safe: Zod and Prisma types only.
import type { AdjustmentType } from "@prisma/client";
import { z } from "zod";

const ADJUSTMENT_TYPES = ["WEIGHT", "PRICE", "MANUAL"] as const satisfies readonly AdjustmentType[];

export const adjustPriceSchema = z.object({
  adjustmentType: z.enum(ADJUSTMENT_TYPES),
  reason: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        newQuantity: z.number().min(0).optional(),
        newPriceCents: z.number().int().min(0).optional(),
      })
    )
    .max(50)
    .optional(),
  newTotalCents: z.number().int().min(0).optional(),
});

export type AdjustPriceRequest = z.infer<typeof adjustPriceSchema>;
