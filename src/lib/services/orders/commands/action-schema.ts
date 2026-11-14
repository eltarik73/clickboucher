// src/lib/services/orders/commands/action-schema.ts — body of PATCH /api/boucher/orders/[orderId]/action.
// The weight and price adjustments are not actions of this route: a total changes after creation
// only through the tier service /api/orders/[id]/adjust-price, which records the change.
import { z } from "zod";

export const boucherActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), estimatedMinutes: z.number().int().min(0).max(480) }),
  z.object({ action: z.literal("deny"), reason: z.string().min(1).max(500) }),
  z.object({
    action: z.literal("start_preparing"),
    addMinutes: z.number().int().min(0).max(120).optional(),
  }),
  z.object({ action: z.literal("add_time"), addMinutes: z.number().int().min(1).max(120) }),
  z.object({ action: z.literal("mark_ready") }),
  z.object({ action: z.literal("item_unavailable"), itemIds: z.array(z.string().min(1)).min(1) }),
  z.object({ action: z.literal("confirm_pickup"), qrCode: z.string().uuid() }),
  z.object({ action: z.literal("manual_pickup") }),
  z.object({ action: z.literal("cancel"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("add_note"), note: z.string().min(1).max(500) }),
]);

export type BoucherAction = z.infer<typeof boucherActionSchema>;
