// src/lib/services/orders/commands/rate.ts — the customer rates a collected order.
import type { Order, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { transitionOrderInTx } from "@/lib/services/orders/transition";
import type { CommandResult } from "./outcome";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

const ALREADY_RATED: CommandResult<never> = {
  kind: "refused",
  code: "CONFLICT",
  message: "Vous avez déjà noté cette commande",
};

export interface RateOrderInput {
  orderId: string;
  /** Prisma user id of the customer. */
  userId: string;
  rating: number;
  comment?: string;
}

/**
 * Effects of a rating, in the transaction of the write that recorded it: the shop's average and
 * the customer's loyalty counter for that shop. The average is computed by one UPDATE, so two
 * ratings of the same shop committed together both count.
 */
async function applyRating(tx: Tx, order: Order, rating: number): Promise<void> {
  await tx.$executeRaw`
    UPDATE "shops"
    SET "rating" = ROUND((("rating" * "rating_count" + ${rating}) / ("rating_count" + 1))::numeric, 2),
        "rating_count" = "rating_count" + 1
    WHERE "id" = ${order.shopId}`;

  const loyalty = await tx.loyaltyPoint.upsert({
    where: { userId_shopId: { userId: order.userId, shopId: order.shopId } },
    create: { userId: order.userId, shopId: order.shopId, orderCount: 1, rewardsEarned: 0 },
    update: { orderCount: { increment: 1 } },
  });
  const rule = await tx.loyaltyRule.findFirst({ where: { shopId: order.shopId, active: true } });
  if (rule && loyalty.orderCount % rule.ordersRequired === 0) {
    await tx.loyaltyPoint.update({
      where: { id: loyalty.id },
      data: { rewardsEarned: { increment: 1 } },
    });
  }
}

/**
 * PICKED_UP -> COMPLETED with the rating, written only while the order has none. An order already
 * COMPLETED without a rating gets the rating through the same kind of conditional write, without a
 * status change. A second rating is refused, never replayed.
 */
export async function rateOrder(input: RateOrderInput): Promise<CommandResult<Order>> {
  const scope = { userId: input.userId };
  const ratingData = { rating: input.rating, ratingComment: input.comment ?? null };

  return prisma.$transaction(async (tx): Promise<CommandResult<Order>> => {
    const current = await tx.order.findFirst({
      where: { id: input.orderId, userId: input.userId },
      select: { status: true, rating: true },
    });
    if (current === null) return { kind: "not_found" };
    if (current.rating !== null) return ALREADY_RATED;

    if (current.status === "COMPLETED") {
      const { count } = await tx.order.updateMany({
        where: { id: input.orderId, userId: input.userId, status: "COMPLETED", rating: null },
        data: ratingData,
      });
      if (count === 0) return ALREADY_RATED;
      const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
      await applyRating(tx, order, input.rating);
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          shopId: order.shopId,
          type: "RATED",
          actorId: input.userId,
          payloadJson: { rating: input.rating },
        },
      });
      return { kind: "done", data: order };
    }

    const outcome = await transitionOrderInTx(tx, {
      orderId: input.orderId,
      scope,
      from: ["PICKED_UP"],
      to: "COMPLETED",
      where: { rating: null },
      data: ratingData,
      event: { type: "COMPLETED", actorId: input.userId, payload: { rating: input.rating } },
      effects: (effectTx, order) => applyRating(effectTx, order, input.rating),
    });
    if (outcome.ok) return { kind: "done", data: outcome.order };
    if (outcome.reason === "NOT_FOUND") return { kind: "not_found" };
    if (outcome.currentStatus === "COMPLETED") return ALREADY_RATED;
    return { kind: "conflict", currentStatus: outcome.currentStatus };
  }, TRANSACTION_OPTIONS);
}
