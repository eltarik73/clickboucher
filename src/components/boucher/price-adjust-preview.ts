// src/components/boucher/price-adjust-preview.ts — what the butcher typed in his price adjustment
// window, read as the request the server receives, and planned by the server's own planner
// (planAdjustment, src/lib/pricing/adjustment.ts) so the window shows the plan before he sends it.
// The server plans again on send, under the order lock and with the platform's cap.
//
// Pure and client-safe: no database, no clock, no I/O.
import type { AdjustmentType } from "@prisma/client";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import type { AdjustPriceRequest } from "@/lib/price-adjustment-request";
import { planAdjustment, type AdjustmentPlan } from "@/lib/pricing/adjustment";

/** The fields of the butcher's window, as typed: by line id, and the order total, in euros. */
export interface TypedInputs {
  weights: Readonly<Record<string, string>>;
  prices: Readonly<Record<string, string>>;
  total: string;
}

/** A number typed with a decimal comma or dot; NaN when empty or not a number. */
function parseDecimal(text: string): number {
  const normalized = text.trim().replace(",", ".");
  return normalized === "" ? Number.NaN : Number(normalized);
}

/** Euros typed by the butcher, in cents; NaN stays NaN and the planner refuses it. */
function parseEuros(text: string): number {
  return Math.round(parseDecimal(text) * 100);
}

/** The request for the fields whose typed value differs from the order; null when none does. */
function requestOf(
  order: KitchenOrder,
  tab: AdjustmentType,
  inputs: TypedInputs
): AdjustPriceRequest | null {
  if (tab === "MANUAL") {
    const newTotalCents = parseEuros(inputs.total);
    if (inputs.total.trim() === "" || newTotalCents === order.totalCents) return null;
    return { adjustmentType: "MANUAL", newTotalCents };
  }
  const items: NonNullable<AdjustPriceRequest["items"]> = [];
  for (const item of order.items) {
    const text = tab === "WEIGHT" ? inputs.weights[item.id] : inputs.prices[item.id];
    if (text === undefined) continue;
    if (tab === "WEIGHT") {
      const newQuantity = parseDecimal(text);
      if (newQuantity !== item.quantity) items.push({ orderItemId: item.id, newQuantity });
    } else {
      const newPriceCents = parseEuros(text);
      if (newPriceCents !== item.priceCents) items.push({ orderItemId: item.id, newPriceCents });
    }
  }
  return items.length === 0 ? null : { adjustmentType: tab, items };
}

/** The plan of what the butcher typed; null while no field differs from the order. */
export function previewAdjustment(
  order: KitchenOrder,
  tab: AdjustmentType,
  inputs: TypedInputs
): { request: AdjustPriceRequest; plan: AdjustmentPlan } | null {
  const request = requestOf(order, tab, inputs);
  if (request === null) return null;
  return { request, plan: planAdjustment(order, request) };
}
