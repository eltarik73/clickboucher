// src/lib/pricing/unit-price.ts — the unit price of a product for a customer.
//
// One rule for the product card, the cart estimate and the order:
//   1. base price: the price of the requested cut option (a per-kilogram price that replaces
//      the base price for every customer), else the pro price for a pro customer when one is
//      set, else the public price;
//   2. the product promotion, when active, applied on that base.
// Anti-gaspi and flash sales already rewrite Product.priceCents and need no rule here.
//
// The server calls this with database rows only: the browser names a cut option, it never
// sends a price. Pure and client-safe; the current time is a parameter.

import { assertCents } from "./line";

export interface CutOption {
  name: string;
  priceCents: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads Product.cutOptions (JSON column): an array of { name, priceCents } with a non-empty name
 * and a price in whole non-negative cents. null or undefined => no option. Any other shape throws
 * TypeError: a price is never guessed.
 * A price of 0 is read, not refused: the product validators refuse it on write (at least 1 cent)
 * but rows stored before that rule may carry one. Such an option is never sold (see
 * pricedCutOptions and resolveUnitPrice).
 */
export function parseCutOptions(raw: unknown): CutOption[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new TypeError("cutOptions must be an array of { name, priceCents }");
  }
  return raw.map((entry: unknown, index): CutOption => {
    if (!isRecord(entry)) {
      throw new TypeError(`cutOptions[${index}] must be an object { name, priceCents }`);
    }
    const { name, priceCents } = entry;
    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError(`cutOptions[${index}].name must be a non-empty string`);
    }
    if (typeof priceCents !== "number" || !Number.isSafeInteger(priceCents) || priceCents < 0) {
      throw new TypeError(`cutOptions[${index}].priceCents must be a non-negative integer`);
    }
    return { name, priceCents };
  });
}

/** A cut option's price replaces the price per kilogram: below 1 cent it would sell for nothing. */
const MIN_CUT_PRICE_CENTS = 1;

/** The cut options a customer may choose: those priced at least 1 cent, in stored order. */
export function pricedCutOptions(raw: unknown): CutOption[] {
  return parseCutOptions(raw).filter((option) => option.priceCents >= MIN_CUT_PRICE_CENTS);
}

/** The pricing columns of Product. Dates may be ISO strings (serialized for the browser). */
export interface ProductPricing {
  priceCents: number;
  proPriceCents?: number | null;
  promoPct?: number | null;
  promoType?: string | null;
  promoEnd?: Date | string | null;
  promoFixedCents?: number | null;
  cutOptions?: unknown;
}

export type ProductPromo = { kind: "PERCENT"; pct: number } | { kind: "FIXED"; cents: number };

const FIXED_AMOUNT_PROMO = "FIXED_AMOUNT";
const MIN_PROMO_PCT = 1;
const MAX_PROMO_PCT = 99;

function timeOf(name: string, value: Date | string): number {
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  if (Number.isNaN(time)) throw new TypeError(`${name} is not a valid date`);
  return time;
}

/**
 * The promotion carried by the product at `now`, or null.
 * - Active when it has no end date or the end date is in the future (the product form creates
 *   percentage promotions without end date).
 * - Type FIXED_AMOUNT: promoFixedCents > 0.
 * - Any other type: promoPct in 1..99.
 */
export function activeProductPromo(product: ProductPricing, now: Date): ProductPromo | null {
  const nowTime = timeOf("now", now);
  const promoEnd = product.promoEnd ?? null;
  if (promoEnd !== null && timeOf("promoEnd", promoEnd) <= nowTime) return null;

  if (product.promoType === FIXED_AMOUNT_PROMO) {
    const cents = product.promoFixedCents ?? null;
    return cents !== null && Number.isSafeInteger(cents) && cents > 0
      ? { kind: "FIXED", cents }
      : null;
  }

  const pct = product.promoPct ?? null;
  return pct !== null && Number.isInteger(pct) && pct >= MIN_PROMO_PCT && pct <= MAX_PROMO_PCT
    ? { kind: "PERCENT", pct }
    : null;
}

function applyProductPromo(baseCents: number, promo: ProductPromo | null): number {
  if (promo === null) return baseCents;
  if (promo.kind === "FIXED") return Math.max(0, baseCents - promo.cents);
  return Math.floor((baseCents * (100 - promo.pct) + 50) / 100);
}

export type UnitPrice =
  | {
      ok: true;
      /** Price charged: per kilogram for KG and TRANCHE, per unit otherwise. */
      unitPriceCents: number;
      /** Price before the product promotion. */
      baseCents: number;
      promo: ProductPromo | null;
      /** The requested cut option, with its price read from the product. */
      cutOption: CutOption | null;
    }
  | { ok: false; error: CutOptionIssue };

/**
 * Why a requested cut option has no price: the product does not offer that name, or it offers it
 * at 0 (stored before the validators refused it).
 */
export type CutOptionIssue = "UNKNOWN_CUT_OPTION" | "CUT_OPTION_UNPRICED";

/** Customer-facing text of each issue, after « <produit> : ». */
export const CUT_OPTION_ISSUE_MESSAGES: Record<CutOptionIssue, string> = {
  UNKNOWN_CUT_OPTION: "découpe inconnue",
  CUT_OPTION_UNPRICED: "découpe indisponible",
};

function proPriceOf(product: ProductPricing): number | null {
  const proPriceCents = product.proPriceCents ?? null;
  if (proPriceCents === null) return null;
  assertCents("proPriceCents", proPriceCents);
  // The optional pro-price field accepts 0, and every reader has always taken 0 for "no pro
  // price": it never means "free for pros".
  return proPriceCents > 0 ? proPriceCents : null;
}

/**
 * Unit price of `product` for one customer at `now`.
 * - `cutOption`: the exact name of an option of the product; an unknown name is refused, never
 *   priced at the base price, and so is an option stored at 0, never sold for nothing.
 * - `isPro`: the customer's database role is CLIENT_PRO.
 * Throws RangeError when a price of the product is not whole cents, TypeError when a requested
 * cut option has to be looked up in malformed cutOptions.
 */
export function resolveUnitPrice(
  product: ProductPricing,
  options: { isPro: boolean; cutOption?: string | null; now: Date }
): UnitPrice {
  assertCents("priceCents", product.priceCents);
  const promo = activeProductPromo(product, options.now);
  const requestedCut = options.cutOption ?? null;

  if (requestedCut === null) {
    const baseCents = (options.isPro ? proPriceOf(product) : null) ?? product.priceCents;
    return {
      ok: true,
      unitPriceCents: applyProductPromo(baseCents, promo),
      baseCents,
      promo,
      cutOption: null,
    };
  }

  const cutOption = parseCutOptions(product.cutOptions).find(
    (option) => option.name === requestedCut
  );
  if (cutOption === undefined) return { ok: false, error: "UNKNOWN_CUT_OPTION" };
  if (cutOption.priceCents < MIN_CUT_PRICE_CENTS)
    return { ok: false, error: "CUT_OPTION_UNPRICED" };
  return {
    ok: true,
    unitPriceCents: applyProductPromo(cutOption.priceCents, promo),
    baseCents: cutOption.priceCents,
    promo,
    cutOption,
  };
}
