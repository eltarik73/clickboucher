// src/lib/pricing/discount.ts — what a promo code or a loyalty reward takes off an order.
//
// The amount is computed here from the offer row and the recomputed goods subtotal; the
// browser sends a code and never an amount. At most one discount per order, on the goods
// subtotal and capped at it. « Frais offerts » waives the service fee and never discounts goods.
//
// This module holds the amounts and the pure predicates. Who the customer is, whether the code
// was already used and the consumption of a use are database questions answered by
// src/lib/services/orders. Pure and client-safe; the current time is a parameter.

import { assertCents } from "./line";

export type OfferKind = "PERCENT" | "AMOUNT" | "FREE_FEES" | "BOGO" | "BUNDLE";

export type DiscountRejection =
  | "MIN_ORDER_NOT_REACHED"
  | "UNSUPPORTED_OFFER_TYPE"
  | "NO_SERVICE_FEE_TO_WAIVE"
  | "INVALID_OFFER_VALUE";

export type DiscountAmount =
  | { ok: true; discountCents: number; waivesServiceFee: boolean }
  | { ok: false; reason: DiscountRejection; minOrderCents?: number };

const HUNDREDTHS_PER_PERCENT = 100;
const MIN_PERCENT_HUNDREDTHS = 1 * HUNDREDTHS_PER_PERCENT;
const MAX_PERCENT_HUNDREDTHS = 100 * HUNDREDTHS_PER_PERCENT;
/** Tolerance when reading a Float column: 1.1 * 100 is 110.00000000000001 in binary. */
const FLOAT_NOISE = 1e-6;

function invalidOfferValue(): DiscountAmount {
  return { ok: false, reason: "INVALID_OFFER_VALUE" };
}

/**
 * A percentage stored in a Float column, as whole hundredths of a percent. null unless the
 * value lies in 1..100 and has at most two decimals: an amount is never computed from a
 * percentage that cannot be represented exactly.
 */
function percentHundredths(percent: number): number | null {
  if (!Number.isFinite(percent)) return null;
  const hundredths = Math.round(percent * HUNDREDTHS_PER_PERCENT);
  if (Math.abs(percent * HUNDREDTHS_PER_PERCENT - hundredths) > FLOAT_NOISE) return null;
  if (hundredths < MIN_PERCENT_HUNDREDTHS || hundredths > MAX_PERCENT_HUNDREDTHS) return null;
  return hundredths;
}

/** Half-up to the cent in integer arithmetic; for a whole percentage: floor((amount * pct + 50) / 100). */
function percentOfCents(amountCents: number, hundredths: number): number {
  const scale = 100 * HUNDREDTHS_PER_PERCENT;
  return Math.floor((amountCents * hundredths + scale / 2) / scale);
}

/** Euros stored in a Float column, as cents. null when the value is not a finite, non-negative amount. */
function eurosToCents(euros: number): number | null {
  if (!Number.isFinite(euros) || euros < 0) return null;
  const cents = Math.round(euros * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** What the offer grants on this basket, before its minimum order is looked at. */
function offerGrant(
  offer: { type: OfferKind; discountValue: number },
  basket: { subtotalCents: number; serviceFeeCents: number }
): DiscountAmount {
  switch (offer.type) {
    case "PERCENT": {
      const hundredths = percentHundredths(offer.discountValue);
      if (hundredths === null) return invalidOfferValue();
      return {
        ok: true,
        discountCents: percentOfCents(basket.subtotalCents, hundredths),
        waivesServiceFee: false,
      };
    }
    case "AMOUNT": {
      const amountCents = eurosToCents(offer.discountValue);
      if (amountCents === null || amountCents < 1) return invalidOfferValue();
      return {
        ok: true,
        discountCents: Math.min(amountCents, basket.subtotalCents),
        waivesServiceFee: false,
      };
    }
    case "FREE_FEES":
      return basket.serviceFeeCents === 0
        ? { ok: false, reason: "NO_SERVICE_FEE_TO_WAIVE" }
        : { ok: true, discountCents: 0, waivesServiceFee: true };
    default:
      // BOGO, BUNDLE, and any type this module does not know.
      return { ok: false, reason: "UNSUPPORTED_OFFER_TYPE" };
  }
}

/**
 * Discount of an offer on a basket. `offer.discountValue` and `offer.minOrder` are the Float
 * columns (a percentage, or euros).
 * - BOGO, BUNDLE: refused — their meaning for products sold by weight is not defined.
 * - PERCENT: 1..100 (at most two decimals), half-up to the cent.
 * - AMOUNT: at least one cent, capped at the subtotal.
 * - FREE_FEES: waives the service fee, never discounts goods; refused while the order carries no
 *   fee, so that no use of the code is spent for nothing.
 * A reason that no basket can lift (type, value, no fee to waive) is reported before the minimum
 * order, which is compared with the goods subtotal.
 * Throws RangeError when the basket amounts are not whole cents.
 */
export function offerDiscount(
  offer: { type: OfferKind; discountValue: number; minOrder: number },
  basket: { subtotalCents: number; serviceFeeCents: number }
): DiscountAmount {
  assertCents("subtotalCents", basket.subtotalCents);
  assertCents("serviceFeeCents", basket.serviceFeeCents);

  const grant = offerGrant(offer, basket);
  if (!grant.ok) return grant;

  const minOrderCents = eurosToCents(offer.minOrder);
  if (minOrderCents === null) return invalidOfferValue();
  if (basket.subtotalCents < minOrderCents) {
    return { ok: false, reason: "MIN_ORDER_NOT_REACHED", minOrderCents };
  }
  return grant;
}

/**
 * Discount of a loyalty reward on the goods subtotal: FIXED = rewardCents capped at the
 * subtotal, PERCENT = like a PERCENT offer. Throws RangeError when the subtotal is not whole cents.
 */
export function loyaltyRewardDiscount(
  reward: { rewardType: string; rewardCents: number | null; rewardPercent: number | null },
  subtotalCents: number
): DiscountAmount {
  assertCents("subtotalCents", subtotalCents);

  if (reward.rewardType === "FIXED") {
    const { rewardCents } = reward;
    if (rewardCents === null || !Number.isSafeInteger(rewardCents) || rewardCents < 1) {
      return invalidOfferValue();
    }
    return {
      ok: true,
      discountCents: Math.min(rewardCents, subtotalCents),
      waivesServiceFee: false,
    };
  }

  if (reward.rewardType === "PERCENT") {
    const hundredths =
      reward.rewardPercent === null ? null : percentHundredths(reward.rewardPercent);
    if (hundredths === null) return invalidOfferValue();
    return {
      ok: true,
      discountCents: percentOfCents(subtotalCents, hundredths),
      waivesServiceFee: false,
    };
  }

  return { ok: false, reason: "UNSUPPORTED_OFFER_TYPE" };
}

/**
 * Whether an offer may be used in `shopId`:
 * - a shop offer, only in its shop;
 * - a platform offer paid by Klik&Go, everywhere;
 * - a platform offer paid by the butcher, only where the shop accepted the proposal.
 */
export function offerAppliesToShop(
  offer: { shopId: string | null; payer: "KLIKGO" | "BUTCHER" },
  shopId: string,
  hasAcceptedProposal: boolean
): boolean {
  if (offer.shopId !== null) return offer.shopId === shopId;
  return offer.payer === "KLIKGO" || hasAcceptedProposal;
}

export type OfferWindow = "OK" | "NOT_ACTIVE" | "NOT_STARTED" | "EXPIRED" | "EXHAUSTED";

function timeOf(name: string, date: Date): number {
  const time = date.getTime();
  if (Number.isNaN(time)) throw new TypeError(`${name} is not a valid date`);
  return time;
}

/**
 * Whether an offer can be redeemed at `now`: status ACTIVE, startDate <= now < endDate, uses left
 * (maxUses null = unlimited). The first failing condition is reported, in that order; a status
 * EXPIRED reads as "EXPIRED", any other non-active status as "NOT_ACTIVE".
 */
export function offerWindow(
  offer: {
    status: string;
    startDate: Date;
    endDate: Date;
    maxUses: number | null;
    currentUses: number;
  },
  now: Date
): OfferWindow {
  const nowTime = timeOf("now", now);
  const startTime = timeOf("startDate", offer.startDate);
  const endTime = timeOf("endDate", offer.endDate);

  if (offer.status === "EXPIRED") return "EXPIRED";
  if (offer.status !== "ACTIVE") return "NOT_ACTIVE";
  if (nowTime < startTime) return "NOT_STARTED";
  if (nowTime >= endTime) return "EXPIRED";
  if (offer.maxUses !== null && offer.currentUses >= offer.maxUses) return "EXHAUSTED";
  return "OK";
}
