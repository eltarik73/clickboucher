// src/components/boucher/price-adjust-preview.ts — what a price adjustment typed by the butcher
// will do, computed in his window before anything is sent, with the server's own pure rules: the
// new line totals (src/lib/pricing/adjustment.ts), the new order total as adjust-price.ts sums it,
// and whether it applies at once or needs the customer's yes (decideAdjustment, tolerance.ts).
// The server decides again on send; this only lets the window say the same thing beforehand.
//
// Pure and client-safe: no database, no clock, no I/O.
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { MAX_INCREASE_PCT } from "@/lib/price-adjustment-config";
import {
  availableLinesAfter,
  repriceLine,
  reweighLine,
  type AdjustedLine,
} from "@/lib/pricing/adjustment";
import {
  decideAdjustment,
  type AdjustmentDecision,
  type AdjustmentKind,
} from "@/lib/pricing/tolerance";
import { kitchenStoredLine } from "./OrderTicket";
import { kitchenOrderTolerance } from "./tolerance-ticket-line";

type KitchenItem = KitchenOrder["items"][number];

/** The columns of a kitchen order the preview reads. */
export type PreviewOrder = Pick<
  KitchenOrder,
  "totalCents" | "weighToleranceRateBps" | "weighToleranceCapCents" | "estimatedTotalCents"
> & {
  items: ReadonlyArray<
    Pick<
      KitchenItem,
      | "id"
      | "name"
      | "unit"
      | "quantity"
      | "weightGrams"
      | "priceCents"
      | "totalCents"
      | "estimatedPriceCents"
      | "available"
    >
  >;
};

/** What the butcher typed, by line id: kilograms (weighed units) or a count, or cents per unit. */
export type AdjustmentDraft =
  | { adjustmentType: "WEIGHT"; newQuantities: Readonly<Record<string, number>> }
  | { adjustmentType: "PRICE"; newPricesCents: Readonly<Record<string, number>> }
  | { adjustmentType: "MANUAL"; newTotalCents: number };

/** Body of PATCH /api/orders/[id]/adjust-price (adjustPriceSchema), without the reason. */
export type AdjustPriceRequest = {
  adjustmentType: AdjustmentKind;
  items?: Array<{ orderItemId: string; newQuantity?: number; newPriceCents?: number }>;
  newTotalCents?: number;
};

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

/** Euros typed by the butcher, in cents; NaN stays NaN and previewAdjustment refuses it. */
function parseEuros(text: string): number {
  return Math.round(parseDecimal(text) * 100);
}

function parseAll(
  inputs: Readonly<Record<string, string>>,
  parse: (text: string) => number
): Record<string, number> {
  return Object.fromEntries(Object.entries(inputs).map(([id, text]) => [id, parse(text)]));
}

/** The draft of the active tab, from the fields as typed (kilograms or a count, euros). */
export function draftFromInputs(tab: AdjustmentKind, inputs: TypedInputs): AdjustmentDraft {
  if (tab === "WEIGHT") {
    return { adjustmentType: "WEIGHT", newQuantities: parseAll(inputs.weights, parseDecimal) };
  }
  if (tab === "PRICE") {
    return { adjustmentType: "PRICE", newPricesCents: parseAll(inputs.prices, parseEuros) };
  }
  return { adjustmentType: "MANUAL", newTotalCents: parseEuros(inputs.total) };
}

export type AdjustmentPreview =
  | {
      ok: true;
      request: AdjustPriceRequest;
      newTotalCents: number;
      /** Highest total the platform's default cap allows (+MAX_INCREASE_PCT % of the current). */
      maxTotalCents: number;
      decision: AdjustmentDecision;
    }
  | { ok: false; itemId: string | null; message: string };

const LINE_REFUSALS: Record<Extract<AdjustedLine, { ok: false }>["reason"], string> = {
  QUANTITY_INVALID: "quantité invalide (poids au gramme près, pièces sans décimale)",
  PRICE_INVALID: "prix invalide",
  LINE_NOT_ADJUSTABLE: "cette ligne ne peut pas être ajustée",
};

type LineChange = { item: PreviewOrder["items"][number]; value: number };

function refuseLine(
  item: LineChange["item"],
  reason: keyof typeof LINE_REFUSALS
): Extract<AdjustmentPreview, { ok: false }> {
  return { ok: false, itemId: item.id, message: `${item.name} : ${LINE_REFUSALS[reason]}` };
}

/** The available lines whose typed value differs from the stored one. */
function changedLines(order: PreviewOrder, draft: AdjustmentDraft): LineChange[] {
  if (draft.adjustmentType === "MANUAL") return [];
  const typed = draft.adjustmentType === "WEIGHT" ? draft.newQuantities : draft.newPricesCents;
  const changes: LineChange[] = [];
  for (const item of order.items) {
    const value = typed[item.id];
    if (!item.available || value === undefined) continue;
    const stored = draft.adjustmentType === "WEIGHT" ? item.quantity : item.priceCents;
    if (value !== stored) changes.push({ item, value });
  }
  return changes;
}

function decide(
  order: PreviewOrder,
  adjustmentType: AdjustmentKind,
  newTotalCents: number,
  newLineTotals: Array<{ orderItemId: string; newTotalCents: number }>
): AdjustmentDecision {
  const lines = order.items.map((item) => ({
    id: item.id,
    available: item.available,
    totalCents: item.totalCents,
    estimatedPriceCents: item.estimatedPriceCents ?? null,
  }));
  return decideAdjustment({
    adjustmentType,
    currentTotalCents: order.totalCents,
    newTotalCents,
    tolerance: kitchenOrderTolerance(order),
    lines: availableLinesAfter(lines, newLineTotals),
  });
}

/** The request, the new total and the server's decision for what the butcher typed. */
export function previewAdjustment(order: PreviewOrder, draft: AdjustmentDraft): AdjustmentPreview {
  const maxTotalCents = Math.round(order.totalCents * (1 + MAX_INCREASE_PCT / 100));
  if (draft.adjustmentType === "MANUAL") {
    const { newTotalCents } = draft;
    if (!Number.isSafeInteger(newTotalCents) || newTotalCents < 0) {
      return { ok: false, itemId: null, message: "Montant invalide" };
    }
    return {
      ok: true,
      request: { adjustmentType: "MANUAL", newTotalCents },
      newTotalCents,
      maxTotalCents,
      decision: decide(order, "MANUAL", newTotalCents, []),
    };
  }

  const items: NonNullable<AdjustPriceRequest["items"]> = [];
  const newLineTotals: Array<{ orderItemId: string; newTotalCents: number }> = [];
  let difference = 0;
  for (const { item, value } of changedLines(order, draft)) {
    const line = { ...kitchenStoredLine(item), priceCents: item.priceCents };
    const adjusted =
      draft.adjustmentType === "WEIGHT" ? reweighLine(line, value) : repriceLine(line, value);
    if (!adjusted.ok) return refuseLine(item, adjusted.reason);
    // A price so large that the line total leaves the safe integers is not a price.
    if (!Number.isSafeInteger(adjusted.totalCents)) return refuseLine(item, "PRICE_INVALID");
    items.push(
      draft.adjustmentType === "WEIGHT"
        ? { orderItemId: item.id, newQuantity: value }
        : { orderItemId: item.id, newPriceCents: value }
    );
    newLineTotals.push({ orderItemId: item.id, newTotalCents: adjusted.totalCents });
    difference += adjusted.totalCents - item.totalCents;
  }
  // Same sum as adjust-price.ts: the stored total moved by the change of each line.
  const newTotalCents = Math.max(0, order.totalCents + difference);
  return {
    ok: true,
    request: { adjustmentType: draft.adjustmentType, items },
    newTotalCents,
    maxTotalCents,
    decision: decide(order, draft.adjustmentType, newTotalCents, newLineTotals),
  };
}
