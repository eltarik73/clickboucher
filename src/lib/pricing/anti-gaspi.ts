// src/lib/pricing/anti-gaspi.ts — when an anti-gaspi discount stops applying.
//
// Why this rule exists: the butcher's anti-gaspi action (POST /api/boucher/anti-gaspi) rewrites
// Product.priceCents to the discounted price, keeps the original in antiGaspiOrigPriceCents and
// sets an end date antiGaspiEndAt. Nothing writes the original price back at that date: only the
// butcher ending the mode does. Every reader therefore sees the product as it is at `now`: from
// antiGaspiEndAt on, the mode is off and the price is the original one. No end date means no end.
// An expired row whose original price is unknown (NULL) keeps priceCents and loses the mode.
//
// The pricing chantier will replace the rewrite of priceCents by a time-bounded rule (the discount
// stored apart and applied by resolveUnitPrice until its end); until then this module is the one
// place that knows the end date. Pure and client-safe; the current time is a parameter.
import type { Prisma } from "@prisma/client";
import { assertCents } from "./line";

/** The anti-gaspi columns of Product. Dates may be ISO strings (serialized for the browser). */
export interface AntiGaspiColumns {
  priceCents: number;
  isAntiGaspi?: boolean | null;
  antiGaspiOrigPriceCents?: number | null;
  antiGaspiEndAt?: Date | string | null;
  antiGaspiStock?: number | null;
  antiGaspiReason?: string | null;
}

/** What a server read must select, next to priceCents, to price and count an anti-gaspi product. */
export const antiGaspiPricingSelect = {
  isAntiGaspi: true,
  antiGaspiOrigPriceCents: true,
  antiGaspiEndAt: true,
  antiGaspiStock: true,
} satisfies Prisma.ProductSelect;

/** Columns emptied when the mode is over, as the butcher's « end anti-gaspi » action does. */
const ENDED_MODE_FIELDS = [
  "antiGaspiOrigPriceCents",
  "antiGaspiEndAt",
  "antiGaspiStock",
  "antiGaspiReason",
] as const;

function timeOf(name: string, value: Date | string): number {
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  if (Number.isNaN(time)) throw new TypeError(`${name} is not a valid date`);
  return time;
}

/**
 * True when the product is in anti-gaspi and its end date is reached (end <= now).
 * Throws TypeError when that end date, or `now`, is not a valid date.
 */
export function antiGaspiExpired(
  product: Pick<AntiGaspiColumns, "isAntiGaspi" | "antiGaspiEndAt">,
  now: Date
): boolean {
  const endAt = product.antiGaspiEndAt ?? null;
  if (!product.isAntiGaspi || endAt === null) return false;
  return timeOf("antiGaspiEndAt", endAt) <= timeOf("now", now);
}

/**
 * The price a customer pays before pro price, cut option and promotion: the original price once
 * the anti-gaspi discount has expired (when it is known), else priceCents.
 * Throws RangeError when that price is not whole cents.
 */
export function publicPriceCents(product: AntiGaspiColumns, now: Date): number {
  const original = antiGaspiExpired(product, now)
    ? (product.antiGaspiOrigPriceCents ?? null)
    : null;
  const price = original ?? product.priceCents;
  assertCents(original === null ? "priceCents" : "antiGaspiOrigPriceCents", price);
  return price;
}

/**
 * The product as it must be seen at `now`: the same object while its anti-gaspi discount is in
 * force (or it has none); once expired, a copy at its public price with the mode off and the
 * anti-gaspi columns it carries emptied (counter included: it no longer limits the sale).
 */
export function settleAntiGaspi<T extends AntiGaspiColumns>(product: T, now: Date): T {
  if (!antiGaspiExpired(product, now)) return product;
  const emptied: Partial<Record<(typeof ENDED_MODE_FIELDS)[number], null>> = {};
  for (const field of ENDED_MODE_FIELDS) {
    if (field in product) emptied[field] = null;
  }
  return { ...product, ...emptied, priceCents: publicPriceCents(product, now), isAntiGaspi: false };
}

/** The in-force rule as a Prisma filter: in anti-gaspi, without end date or with an end ahead. */
export function antiGaspiInForceWhere(now: Date): Prisma.ProductWhereInput {
  return { isAntiGaspi: true, OR: [{ antiGaspiEndAt: null }, { antiGaspiEndAt: { gt: now } }] };
}
