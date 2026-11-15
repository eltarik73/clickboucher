// src/lib/services/orders/commands/close.ts — the ways an order ends without being collected:
// refused or cancelled by the butcher, cancelled by the customer, expired (system: its deadline
// passed, or its unpaid Checkout Session expired).
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { countsTowardAutoPause } from "@/lib/auth/guest-auth";
import { logger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import { holdsLimitedStock } from "@/lib/order-state-machine";
import { closePendingAdjustment } from "@/lib/services/orders/adjustment-closure";
import { releaseOrderDiscount } from "@/lib/services/orders/discount-ledger";
import { orderClientName, orderPersonColumns } from "@/lib/services/orders/order-person";
import {
  SYSTEM_ACTOR_ID,
  transitionOrder,
  type TransitionScope,
} from "@/lib/services/orders/transition";
import { unappliedTransition, type CommandResult } from "./outcome";
import { releaseHeldStock } from "@/lib/services/orders/stock-hold";

type Tx = Prisma.TransactionClient;

/** Customers may cancel an ACCEPTED order during this window after its creation. */
export const CUSTOMER_CANCELLATION_WINDOW_MS = 5 * 60_000;

/**
 * Effects of every closing transition: closes a pending price adjustment unapplied, gives back the
 * promo code use or loyalty reward the order consumed, then the limited stock it held (offer before
 * products: the lock order of transition.ts).
 */
export async function releaseClosedOrder(
  tx: Tx,
  order: Order,
  previousStatus: OrderStatus
): Promise<void> {
  await closePendingAdjustment(tx, order.id, order.updatedAt);
  await releaseOrderDiscount(tx, order);
  if (holdsLimitedStock(previousStatus)) await releaseHeldStock(tx, order);
}

const NOTIFICATION_SELECT = {
  orderNumber: true,
  userId: true,
  createdAt: true,
  shop: { select: { name: true } },
  user: { select: { firstName: true, lastName: true } },
  ...orderPersonColumns,
} satisfies Prisma.OrderSelect;

async function closeOrder(input: {
  orderId: string;
  scope: TransitionScope;
  from: readonly OrderStatus[];
  to: "DENIED" | "CANCELLED" | "AUTO_CANCELLED";
  where?: Prisma.OrderWhereInput;
  data?: Prisma.OrderUncheckedUpdateManyInput;
  event: { type: string; actorId: string; payload?: Prisma.InputJsonObject };
}) {
  const outcome = await transitionOrder({ ...input, effects: releaseClosedOrder });
  if (outcome.ok) return { kind: "done" as const, data: outcome.order };
  return unappliedTransition(outcome, { orderId: input.orderId, scope: input.scope, to: input.to });
}

interface ShopCloseInput {
  orderId: string;
  shopId: string;
  actorId: string;
}

/** Butcher refusal: PENDING, ACCEPTED or PARTIALLY_DENIED -> DENIED. */
export async function denyOrder(
  input: ShopCloseInput & { reason: string }
): Promise<CommandResult<Order>> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, shopId: input.shopId },
    select: NOTIFICATION_SELECT,
  });
  if (order === null) return { kind: "not_found" };

  const result = await closeOrder({
    orderId: input.orderId,
    scope: { shopId: input.shopId },
    from: ["PENDING", "ACCEPTED", "PARTIALLY_DENIED"],
    to: "DENIED",
    data: { denyReason: input.reason },
    event: { type: "DENIED", actorId: input.actorId, payload: { reason: input.reason } },
  });
  if (result.kind === "done") {
    await sendNotification("ORDER_DENIED", {
      userId: order.userId,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      denyReason: input.reason,
    });
  }
  return result;
}

const SHOP_CANCEL_REASON = "Annulée par le boucher";

/** Butcher cancellation: PENDING, ACCEPTED, PREPARING or PARTIALLY_DENIED -> CANCELLED. */
export async function cancelOrderByShop(
  input: ShopCloseInput & { reason?: string }
): Promise<CommandResult<Order>> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, shopId: input.shopId },
    select: NOTIFICATION_SELECT,
  });
  if (order === null) return { kind: "not_found" };

  const reason = input.reason || SHOP_CANCEL_REASON;
  const result = await closeOrder({
    orderId: input.orderId,
    scope: { shopId: input.shopId },
    from: ["PENDING", "ACCEPTED", "PREPARING", "PARTIALLY_DENIED"],
    to: "CANCELLED",
    data: { denyReason: reason },
    event: { type: "CANCELLED", actorId: input.actorId, payload: { by: "shop", reason } },
  });
  if (result.kind === "done") {
    await sendNotification("ORDER_CANCELLED", {
      userId: order.userId,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      denyReason: reason,
    });
  }
  return result;
}

/**
 * Customer cancellation: PENDING, or ACCEPTED less than 5 minutes after creation (the rule of
 * isCancellable), with the window written into the conditional update.
 */
export async function cancelOrderByCustomer(input: {
  orderId: string;
  userId: string;
  now: Date;
}): Promise<CommandResult<Order>> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, userId: input.userId },
    select: { ...NOTIFICATION_SELECT, shopId: true },
  });
  if (order === null) return { kind: "not_found" };

  const windowStart = new Date(input.now.getTime() - CUSTOMER_CANCELLATION_WINDOW_MS);
  const result = await closeOrder({
    orderId: input.orderId,
    scope: { userId: input.userId },
    from: ["PENDING", "ACCEPTED"],
    to: "CANCELLED",
    where: { OR: [{ status: "PENDING" }, { status: "ACCEPTED", createdAt: { gt: windowStart } }] },
    event: { type: "CANCELLED", actorId: input.userId, payload: { by: "customer" } },
  });

  if (
    result.kind === "conflict" &&
    result.currentStatus === "ACCEPTED" &&
    order.createdAt <= windowStart
  ) {
    return {
      kind: "refused",
      code: "CONFLICT",
      message:
        "Le délai d'annulation de 5 minutes est dépassé : la boutique a déjà accepté votre commande.",
      details: { currentStatus: ["ACCEPTED"] },
    };
  }
  if (result.kind === "done") {
    await sendNotification("ORDER_CANCELLED_BY_CUSTOMER", {
      shopId: order.shopId,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      customerName: orderClientName(order),
    });
  }
  return result;
}

/** System: PENDING -> AUTO_CANCELLED where `where` holds, then ORDER_EXPIRED to the customer. */
async function expirePendingOrder(input: {
  orderId: string;
  now: Date;
  where: Prisma.OrderWhereInput;
  payload?: Prisma.InputJsonObject;
}): Promise<CommandResult<Order>> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: NOTIFICATION_SELECT,
  });
  if (order === null) return { kind: "not_found" };

  const result = await closeOrder({
    orderId: input.orderId,
    scope: { system: true },
    from: ["PENDING"],
    to: "AUTO_CANCELLED",
    where: input.where,
    data: { autoCancelledAt: input.now },
    event: { type: "AUTO_CANCELLED", actorId: SYSTEM_ACTOR_ID, payload: input.payload },
  });
  if (result.kind === "done") {
    await sendNotification("ORDER_EXPIRED", {
      userId: order.userId,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
    });
  }
  return result;
}

/** System: PENDING -> AUTO_CANCELLED once expiresAt has passed. */
export function expireOrder(input: { orderId: string; now: Date }): Promise<CommandResult<Order>> {
  return expirePendingOrder({ ...input, where: { expiresAt: { lte: input.now } } });
}

/**
 * System, on checkout.session.expired: PENDING -> AUTO_CANCELLED for an order paid ONLINE that is
 * neither authorised nor paid and bound to this session or to none yet.
 */
export function expireUnpaidCheckout(input: {
  orderId: string;
  checkoutSessionId: string;
  now: Date;
}): Promise<CommandResult<Order>> {
  const { checkoutSessionId } = input;
  return expirePendingOrder({
    orderId: input.orderId,
    now: input.now,
    where: {
      paymentMethod: "ONLINE",
      paymentAuthorizedAt: null,
      paidAt: null,
      OR: [{ stripeCheckoutSessionId: null }, { stripeCheckoutSessionId: checkoutSessionId }],
    },
    payload: { reason: "CHECKOUT_SESSION_EXPIRED", checkoutSessionId },
  });
}

/** Most orders one expiry run takes; the rest is counted and waits for the next run. */
const EXPIRY_BATCH_SIZE = 200;

/**
 * Expires the due PENDING orders one by one, oldest deadline first, and stops taking new ones once
 * `deadline` has passed so the caller answers before its function is killed. An order that cannot
 * be expired is logged and does not stop the others. expiredShopIds = the shop of each order this
 * run expired; missedShopIds = the same for the orders that count as missed by the shop (feeding
 * auto-pause), which leaves out guest orders (countsTowardAutoPause). remainingCount = due orders
 * still PENDING.
 */
export async function expireDueOrders(input: { now: Date; deadline: Date }): Promise<{
  expiredShopIds: string[];
  missedShopIds: string[];
  failed: number;
  remainingCount: number;
}> {
  const due: Prisma.OrderWhereInput = {
    status: "PENDING",
    expiresAt: { not: null, lte: input.now },
  };
  const candidates = await prisma.order.findMany({
    where: due,
    select: { id: true, placedAsGuest: true },
    orderBy: { expiresAt: "asc" },
    take: EXPIRY_BATCH_SIZE,
  });

  const expiredShopIds: string[] = [];
  const missedShopIds: string[] = [];
  let failed = 0;
  for (const candidate of candidates) {
    if (Date.now() >= input.deadline.getTime()) break;
    try {
      const result = await expireOrder({ orderId: candidate.id, now: input.now });
      if (result.kind === "done") {
        expiredShopIds.push(result.data.shopId);
        if (countsTowardAutoPause(candidate)) missedShopIds.push(result.data.shopId);
      }
    } catch (error) {
      failed += 1;
      logger.error("[orders/expire] Expiry failed", { orderId: candidate.id, error });
    }
  }
  const remainingCount = await prisma.order.count({ where: due });
  return { expiredShopIds, missedShopIds, failed, remainingCount };
}
