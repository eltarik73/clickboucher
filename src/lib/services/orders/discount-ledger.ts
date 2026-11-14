// src/lib/services/orders/discount-ledger.ts — consumption and release of a promo code use or a
// loyalty reward, inside the order transactions.
//
// Each consumption is one conditional write: the database decides, not a value read earlier.
// - Offer: the increment of current_uses only matches while the offer is redeemable, and it locks
//   the offer row until the order transaction ends, so the once-per-customer check that follows
//   sees every competing order of the same offer that committed before.
// - Loyalty reward: the update only matches while the reward is unused, owned and not expired.
import type { Prisma } from "@prisma/client";
import { DISCOUNT_RELEASING_STATUSES } from "@/lib/order-state-machine";

type Tx = Prisma.TransactionClient;

export type DiscountUnavailableReason =
  | "OFFER_NOT_REDEEMABLE"
  | "OFFER_ALREADY_USED"
  | "REWARD_UNAVAILABLE";

export class DiscountUnavailableError extends Error {
  readonly reason: DiscountUnavailableReason;

  constructor(reason: DiscountUnavailableReason) {
    super(`Discount unavailable: ${reason}`);
    this.name = "DiscountUnavailableError";
    this.reason = reason;
  }
}

/**
 * Takes one use of the offer for this customer. Call it BEFORE inserting the order (whose offerId
 * then points to the offer). Throws DiscountUnavailableError:
 * - OFFER_NOT_REDEEMABLE: not ACTIVE, outside [startDate, endDate), or no use left;
 * - OFFER_ALREADY_USED: the customer has an order with this offer that is not cancelled, denied
 *   or auto-cancelled.
 * The caller's transaction must roll back on a throw (the increment is already written).
 */
export async function consumeOffer(
  tx: Tx,
  input: { offerId: string; userId: string; now: Date }
): Promise<void> {
  const { count } = await tx.offer.updateMany({
    where: {
      id: input.offerId,
      status: "ACTIVE",
      startDate: { lte: input.now },
      endDate: { gt: input.now },
      OR: [{ maxUses: null }, { currentUses: { lt: tx.offer.fields.maxUses } }],
    },
    data: { currentUses: { increment: 1 } },
  });
  if (count === 0) throw new DiscountUnavailableError("OFFER_NOT_REDEEMABLE");

  const previousUse = await tx.order.findFirst({
    where: {
      userId: input.userId,
      offerId: input.offerId,
      status: { notIn: [...DISCOUNT_RELEASING_STATUSES] },
    },
    select: { id: true },
  });
  if (previousUse) throw new DiscountUnavailableError("OFFER_ALREADY_USED");
}

/** Marks the reward used on this order. Call it AFTER inserting the order. */
export async function consumeLoyaltyReward(
  tx: Tx,
  input: { rewardId: string; userId: string; orderId: string; now: Date }
): Promise<void> {
  const { count } = await tx.loyaltyReward.updateMany({
    where: {
      id: input.rewardId,
      userId: input.userId,
      usedAt: null,
      expiresAt: { gt: input.now },
    },
    data: { usedAt: input.now, usedOnOrderId: input.orderId },
  });
  if (count === 0) throw new DiscountUnavailableError("REWARD_UNAVAILABLE");
}

/**
 * Gives back what the order consumed. Call it only from a transition INTO one of
 * DISCOUNT_RELEASING_STATUSES (all terminal, so it runs at most once per order).
 * The offer's use count never goes below 0; the reward is only freed if it is used on this order.
 */
export async function releaseOrderDiscount(
  tx: Tx,
  order: { id: string; offerId: string | null; loyaltyRewardId: string | null }
): Promise<void> {
  if (order.offerId !== null) {
    await tx.offer.updateMany({
      where: { id: order.offerId, currentUses: { gt: 0 } },
      data: { currentUses: { decrement: 1 } },
    });
  }
  if (order.loyaltyRewardId !== null) {
    await tx.loyaltyReward.updateMany({
      where: { id: order.loyaltyRewardId, usedOnOrderId: order.id },
      data: { usedAt: null, usedOnOrderId: null },
    });
  }
}
