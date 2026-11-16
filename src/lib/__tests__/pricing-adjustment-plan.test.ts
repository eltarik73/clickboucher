// @vitest-environment node
//
// planAdjustment: what a request of the butcher does to an order (changed lines, new total,
// decision), or why it is refused, with the sentence he reads. The server and the butcher's window
// both call it. Every expected amount is computed by hand in the comment beside it; the decision
// rule itself is covered by pricing-tolerance-decision.test.ts.
import { describe, expect, it } from "vitest";
import type { AdjustPriceRequest } from "@/lib/price-adjustment-request";
import {
  planAdjustment,
  type AdjustmentRefusalReason,
  type PlannableLine,
  type PlannableOrder,
} from "@/lib/pricing/adjustment";
import type { AdjustmentDecision } from "@/lib/pricing/tolerance";

const kgLine = (id: string, name: string, kg: number, pricePerKg: number, total: number) =>
  ({
    id,
    name,
    unit: "KG",
    quantity: kg,
    weightGrams: kg * 1000,
    priceCents: pricePerKg,
    totalCents: total,
    estimatedPriceCents: total,
    available: true,
  }) satisfies PlannableLine;

// Côte de bœuf 1 kg at 23,96 €/kg; tripes 500 g at 9,02 €/kg: floor((902 x 500 + 500) / 1000) = 451.
const COTE = kgLine("cote", "Côte de bœuf", 1, 2396, 2396);
const TRIPES = kgLine("tripes", "Tripes", 0.5, 902, 451);
const AGNEAU = { ...kgLine("agneau", "Épaule d'agneau", 1, 1500, 1500), available: false };
const MERGUEZ: PlannableLine = {
  id: "merguez",
  name: "Merguez",
  unit: "BARQUETTE",
  quantity: 2,
  weightGrams: null,
  priceCents: 650,
  totalCents: 1300,
  estimatedPriceCents: 1300,
  available: true,
};
// 1.5 pieces at 3,00 €: a fractional count written before the server refused them.
const PAIN: PlannableLine = {
  ...MERGUEZ,
  id: "pain",
  name: "Pain",
  unit: "PIECE",
  quantity: 1.5,
  priceCents: 300,
  totalCents: 450,
  estimatedPriceCents: 450,
};

/** An order with the STANDARD tolerance frozen on its total and no discount. */
const order = (totalCents: number, items: PlannableLine[]): PlannableOrder => ({
  totalCents,
  discountCents: 0,
  weighToleranceRateBps: 500,
  weighToleranceCapCents: 1000,
  estimatedTotalCents: totalCents,
  items,
});
const CAISSE = order(2847, [COTE, TRIPES]); // 23,96 € + 4,51 €
const BARBECUE = order(1751, [TRIPES, MERGUEZ]); // 4,51 € + 13,00 €
const OUT_OF_STOCK = order(2847, [COTE, TRIPES, AGNEAU]);
const DISCOUNTED = { ...order(2347, [COTE, TRIPES]), discountCents: 500 };
const UNFROZEN = { ...CAISSE, weighToleranceRateBps: null, weighToleranceCapCents: null };
const EMPTIED = { ...order(151, [TRIPES]), discountCents: 300 }; // 4,51 € - 3,00 €
const ALL = order(4597, [COTE, TRIPES, AGNEAU, MERGUEZ, PAIN]); // 2396 + 451 + 1300 + 450
// EXTENDED: côte 5 kg (floor((2396 x 5000 + 500) / 1000) = 11980) and one tray at 5,47 €;
// tolerance 10 % x 125,27 € = 12,52 €, more than a tray.
const STEAK: PlannableLine = {
  ...MERGUEZ,
  id: "steak",
  name: "Steak haché (x4)",
  quantity: 1,
  priceCents: 547,
  totalCents: 547,
  estimatedPriceCents: 547,
};
const GRILL: PlannableOrder = {
  ...order(12527, [kgLine("cote", "Côte de bœuf", 5, 2396, 11980), STEAK]),
  weighToleranceRateBps: 1000,
  weighToleranceCapCents: 2000,
};

const weigh = (kgById: Record<string, number>): AdjustPriceRequest => ({
  adjustmentType: "WEIGHT",
  items: Object.entries(kgById).map(([orderItemId, newQuantity]) => ({ orderItemId, newQuantity })),
});
const reprice = (centsById: Record<string, number>): AdjustPriceRequest => ({
  adjustmentType: "PRICE",
  items: Object.entries(centsById).map(([orderItemId, cents]) => ({
    orderItemId,
    newPriceCents: cents,
  })),
});
const manual = (newTotalCents?: number): AdjustPriceRequest => ({
  adjustmentType: "MANUAL",
  newTotalCents,
});

describe("planAdjustment", () => {
  it("plans a 1 g côte and 3,15 kg of tripes: the total goes down, the increase is asked", () => {
    // 1 g at 23,96 €/kg: floor((2396 + 500) / 1000) = 2; 3 150 g at 9,02 €/kg: floor(2841800 / 1000)
    // = 2841; total 2847 - 2394 + 2390 = 2843; base 2 + 451 = 453, tolerance 5 % = 22, increase
    // 0 + 2390.
    expect(planAdjustment(CAISSE, weigh({ cote: 0.001, tripes: 3.15 }))).toEqual({
      ok: true,
      newTotalCents: 2843,
      unchanged: false,
      lineChanges: [
        { orderItemId: "cote", quantity: 0.001, priceCents: 2396, totalCents: 2 },
        { orderItemId: "tripes", quantity: 3.15, priceCents: 902, totalCents: 2841 },
      ],
      decision: {
        decision: "ASK",
        reason: "BEYOND_TOLERANCE",
        toleranceCents: 22,
        cumulatedIncreaseCents: 2390,
        estimatedTotalCents: 453,
      },
    });
  });

  it("plans a new price per tray at the same quantity, asked: not a weighing", () => {
    expect(planAdjustment(BARBECUE, reprice({ merguez: 700 }))).toMatchObject({
      ok: true,
      newTotalCents: 1851, // 1751 + 2 x 0,50 €
      lineChanges: [{ orderItemId: "merguez", quantity: 2, priceCents: 700, totalCents: 1400 }],
      decision: { reason: "NOT_WEIGHING", cumulatedIncreaseCents: 100, estimatedTotalCents: 1751 },
    });
  });

  it("plans a lower total typed by hand without changing any line, applied", () => {
    expect(planAdjustment(CAISSE, manual(2500))).toMatchObject({
      ok: true,
      newTotalCents: 2500,
      unchanged: false,
      lineChanges: [],
      decision: { reason: "DECREASE", cumulatedIncreaseCents: 0, estimatedTotalCents: 2847 },
    });
  });

  type Decided = [string, PlannableOrder, AdjustPriceRequest, number, AdjustmentDecision["reason"]];
  // Tripes 600 g: floor((902 x 600 + 500) / 1000) = 541, +90; 680 g: 613, +162; 657 g: 593, +142,
  // the côte weighed at 1 g counting its 2 cents in the base (2 + 451, 5 % = 0,22 €). GRILL: one
  // more tray, 12527 + 547, is within the tolerance but no weighing. BARBECUE: one tray less.
  it.each<[...Decided, number | null, number | null]>([
    [
      "asks +1,42 € > 0,22 €: a côte weighed at 1 g counts 2 cents",
      CAISSE,
      weigh({ cote: 0.001, tripes: 0.657 }),
      595,
      "BEYOND_TOLERANCE",
      142,
      453,
    ],
    ["asks one more tray", GRILL, weigh({ steak: 2 }), 13074, "NOT_WEIGHING", 547, 12527],
    ["applies one tray less", BARBECUE, weigh({ merguez: 1 }), 1101, "DECREASE", 0, 1101],
    [
      "applies +0,90 € <= 1,42 €",
      CAISSE,
      weigh({ tripes: 0.6 }),
      2937,
      "WITHIN_TOLERANCE",
      90,
      2847,
    ],
    [
      "applies +0,90 € <= 1,17 €",
      DISCOUNTED,
      weigh({ tripes: 0.6 }),
      2437,
      "WITHIN_TOLERANCE",
      90,
      2347,
    ],
    ["asks without tolerance", UNFROZEN, weigh({ tripes: 0.6 }), 2937, "NO_TOLERANCE", 90, null],
    ["never goes below 0", EMPTIED, weigh({ tripes: 0 }), 0, "DECREASE", 0, 0],
    ["asks a higher MANUAL total", CAISSE, manual(2900), 2900, "NOT_WEIGHING", 0, 2847],
    [
      "asks +1,62 € > 1,42 €: no room from the line out of stock",
      OUT_OF_STOCK,
      weigh({ tripes: 0.68 }),
      3009,
      "BEYOND_TOLERANCE",
      162,
      2847,
    ],
  ])("%s", (_label, planned, request, total, reason, increase, base) => {
    expect(planAdjustment(planned, request)).toMatchObject({
      ok: true,
      newTotalCents: total,
      decision: { reason, cumulatedIncreaseCents: increase, estimatedTotalCents: base },
    });
  });

  it.each<[string, PlannableOrder, AdjustPriceRequest, boolean]>([
    ["the stored weights", CAISSE, weigh({ cote: 1, tripes: 0.5 }), true],
    ["the current total typed by hand", CAISSE, manual(2847), true],
    // Tripes at 7,01 €/kg: floor((701 x 500 + 500) / 1000) = 351, -1,00 €; merguez 2 x +0,50 €.
    [
      "two lines moving by -1,00 € and +1,00 €",
      BARBECUE,
      reprice({ merguez: 700, tripes: 701 }),
      false,
    ],
  ])("plans %s at the same total, unchanged: %s", (_label, planned, request, unchanged) => {
    expect(planAdjustment(planned, request)).toMatchObject({
      ok: true,
      newTotalCents: planned.totalCents,
      unchanged,
    });
  });

  it.each<[AdjustPriceRequest, AdjustmentRefusalReason, string | null, string]>([
    [manual(), "TOTAL_MISSING", null, "Nouveau total manquant"],
    [manual(Number.NaN), "TOTAL_INVALID", null, "Montant invalide"],
    [{ adjustmentType: "WEIGHT" }, "CHANGES_MISSING", null, "Données d'ajustement manquantes"],
    [
      {
        adjustmentType: "WEIGHT",
        items: [
          { orderItemId: "pain", newQuantity: 1 },
          { orderItemId: "pain", newQuantity: 2 },
        ],
      },
      "LINE_TWICE",
      null,
      "Article ajusté deux fois",
    ],
    [
      weigh({ agneau: 1.1 }),
      "LINE_UNAVAILABLE",
      "agneau",
      "Article absent de la commande ou en rupture",
    ],
    [
      weigh({ tripes: Number.NaN }),
      "QUANTITY_INVALID",
      "tripes",
      "Tripes : Quantité invalide : poids en grammes entiers, nombre entier pour les pièces",
    ],
    [reprice({ merguez: 12.5 }), "PRICE_INVALID", "merguez", "Merguez : Prix invalide"],
    [
      reprice({ pain: 400 }),
      "LINE_NOT_ADJUSTABLE",
      "pain",
      "Pain : Cette ligne ne peut pas être ajustée",
    ],
  ])("refuses %o: %s", (request, reason, orderItemId, message) => {
    expect(planAdjustment(ALL, request)).toEqual({ ok: false, reason, orderItemId, message });
  });

  it.each<[string, AdjustPriceRequest, AdjustmentRefusalReason, string | null]>([
    ["a negative MANUAL total", manual(-1), "TOTAL_INVALID", null],
    ["a MANUAL total in fractions of a cent", manual(12.5), "TOTAL_INVALID", null],
    ["an empty list of lines", { adjustmentType: "PRICE", items: [] }, "CHANGES_MISSING", null],
    ["a line of another order", weigh({ autre: 1 }), "LINE_UNAVAILABLE", "autre"],
    [
      "a weighing without weight",
      { adjustmentType: "WEIGHT", items: [{ orderItemId: "tripes", newPriceCents: 500 }] },
      "CHANGES_MISSING",
      "tripes",
    ],
    [
      "a new price without price",
      { adjustmentType: "PRICE", items: [{ orderItemId: "merguez", newQuantity: 3 }] },
      "CHANGES_MISSING",
      "merguez",
    ],
    ["half a tray", weigh({ merguez: 1.5 }), "QUANTITY_INVALID", "merguez"],
    ["a price that is not a number", reprice({ merguez: Number.NaN }), "PRICE_INVALID", "merguez"],
    // 2 trays x (2^53 - 1) cents; 9e15 (côte, 1 kg) + 4.5e15 (tripes, 500 g): each past 2^53 - 1.
    [
      "a line total past the safe integers",
      reprice({ merguez: Number.MAX_SAFE_INTEGER }),
      "PRICE_INVALID",
      "merguez",
    ],
    [
      "an order total past the safe integers",
      reprice({ cote: 9e15, tripes: 9e15 }),
      "TOTAL_INVALID",
      null,
    ],
  ])("refuses %s", (_label, request, reason, orderItemId) => {
    expect(planAdjustment(ALL, request)).toMatchObject({ ok: false, reason, orderItemId });
  });
});
