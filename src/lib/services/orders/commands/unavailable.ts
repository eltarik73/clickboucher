// src/lib/services/orders/commands/unavailable.ts — out-of-stock lines: the butcher reports them,
// the customer answers (replace or remove), and the alternatives proposed in between.
import type { Order, OrderItem, OrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { holdsLimitedStock } from "@/lib/order-state-machine";
import { computeOrderTotals } from "@/lib/pricing/totals";
import { closePendingAdjustment } from "@/lib/services/orders/adjustment-settlement";
import { releaseOrderDiscount } from "@/lib/services/orders/discount-ledger";
import { transitionOrder } from "@/lib/services/orders/transition";
import {
  REPLACEMENT_SELECT,
  findAlternatives,
  replacementChange,
  type Alternative,
  type LineChange,
} from "./alternatives";
import {
  STALE_ORDER_REFUSAL,
  StaleOrderError,
  unappliedTransition,
  type CommandResult,
} from "./outcome";
import { releaseHeldStock } from "@/lib/services/orders/stock-hold";

type Tx = Prisma.TransactionClient;

const MINUTE_MS = 60_000;
const PARTIAL_REASON = "Certains articles sont en rupture de stock";
const ALL_UNAVAILABLE_REASON = "Tous les articles sont en rupture de stock";
const ALL_REMOVED_REASON = "Le client a retiré tous les articles";

type LineSnapshot = Pick<
  OrderItem,
  "id" | "productId" | "available" | "totalCents" | "replacement"
>;

function sameLines(expected: readonly LineSnapshot[], actual: readonly LineSnapshot[]): boolean {
  const key = (line: LineSnapshot) =>
    `${line.id}|${line.productId}|${line.available}|${line.totalCents}|${line.replacement ?? ""}`;
  const expectedKeys = expected.map(key).sort();
  const actualKeys = actual.map(key).sort();
  return (
    expectedKeys.length === actualKeys.length && expectedKeys.every((k, i) => k === actualKeys[i])
  );
}

/** Order.totalCents after a change of lines: available lines minus the stored discount, capped. */
function totalAfter(
  lines: ReadonlyArray<{ totalCents: number }>,
  order: { discountCents: number; serviceFeeCents: number }
) {
  return computeOrderTotals({
    lineTotalsCents: lines.map((line) => line.totalCents),
    discountCents: order.discountCents,
    serviceFeeCents: order.serviceFeeCents,
  }).totalCents;
}

const ITEM_SNAPSHOT_SELECT = {
  id: true,
  productId: true,
  available: true,
  totalCents: true,
  replacement: true,
  unit: true,
  quantity: true,
  weightGrams: true,
  name: true,
} satisfies Prisma.OrderItemSelect;

async function readLines(tx: Tx, orderId: string) {
  return tx.orderItem.findMany({ where: { orderId }, select: ITEM_SNAPSHOT_SELECT });
}

/**
 * Butcher: some products of a PENDING or ACCEPTED order are missing. PARTIALLY_DENIED (the
 * customer chooses what to do), or DENIED when no available line is left. In the transaction:
 * lines marked unavailable, products set out of stock, limited stock released when the order held
 * it, total recomputed, discount released when the order is DENIED.
 */
export async function reportUnavailableItems(input: {
  orderId: string;
  shopId: string;
  actorId: string;
  productIds: readonly string[];
}): Promise<CommandResult<{ order: Order; alternatives: Record<string, Alternative[]> }>> {
  const scope = { shopId: input.shopId };
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, shopId: input.shopId },
    select: {
      status: true,
      orderNumber: true,
      userId: true,
      discountCents: true,
      serviceFeeCents: true,
      shop: { select: { name: true } },
      items: { select: ITEM_SNAPSHOT_SELECT },
    },
  });
  if (order === null) return { kind: "not_found" };

  const missing = new Set(input.productIds);
  const unavailableLines = order.items.filter((item) => missing.has(item.productId));
  if (order.status !== "PENDING" && order.status !== "ACCEPTED") {
    // The same report sent again: those lines are already out of stock.
    const reported =
      (order.status === "PARTIALLY_DENIED" || order.status === "DENIED") &&
      [...missing].every((productId) =>
        order.items.some((item) => item.productId === productId && !item.available)
      );
    if (!reported) return { kind: "conflict", currentStatus: order.status };
    const current = await prisma.order.findFirstOrThrow({
      where: { id: input.orderId, shopId: input.shopId },
    });
    return {
      kind: "replay",
      data: {
        order: current,
        alternatives: await findAlternatives(input.shopId, unavailableLines),
      },
    };
  }
  const available = order.items.filter((item) => item.available);
  if ([...missing].some((productId) => !available.some((item) => item.productId === productId))) {
    return {
      kind: "refused",
      code: "VALIDATION_ERROR",
      message: "Article absent de la commande ou déjà signalé",
    };
  }
  const kept = available.filter((item) => !missing.has(item.productId));
  const to: OrderStatus = kept.length === 0 ? "DENIED" : "PARTIALLY_DENIED";

  let outcome;
  try {
    outcome = await transitionOrder({
      orderId: input.orderId,
      scope,
      from: ["PENDING", "ACCEPTED"],
      to,
      data: {
        totalCents: totalAfter(kept, order),
        denyReason: to === "DENIED" ? ALL_UNAVAILABLE_REASON : PARTIAL_REASON,
      },
      event: {
        type: "ITEM_UNAVAILABLE",
        actorId: input.actorId,
        payload: { itemIds: [...missing], resultStatus: to },
      },
      effects: async (tx, changed, previousStatus) => {
        const lines = await readLines(tx, changed.id);
        if (!sameLines(order.items, lines)) throw new StaleOrderError(changed.id);
        // An adjustment computed against the old lines must never be applied to the new ones.
        await closePendingAdjustment(tx, changed.id, changed.updatedAt);
        // Offer before products: the lock order of transition.ts.
        if (to === "DENIED") await releaseOrderDiscount(tx, changed);
        if (holdsLimitedStock(previousStatus)) await releaseHeldStock(tx, changed);
        // A reported line that was itself a replacement is missing again: it goes back to the
        // customer's choices, so it no longer carries the replacement it was.
        await tx.orderItem.updateMany({
          where: { orderId: changed.id, productId: { in: [...missing] }, available: true },
          data: { available: false, replacement: null },
        });
        await tx.product.updateMany({
          where: { id: { in: [...missing] }, shopId: changed.shopId },
          data: { inStock: false },
        });
      },
    });
  } catch (error) {
    if (error instanceof StaleOrderError) return STALE_ORDER_REFUSAL;
    throw error;
  }

  if (!outcome.ok) {
    const result = await unappliedTransition(outcome, { orderId: input.orderId, scope, to });
    if (result.kind !== "replay") return result;
    return {
      kind: "replay",
      data: {
        order: result.data,
        alternatives: await findAlternatives(input.shopId, unavailableLines),
      },
    };
  }

  // Nothing left to choose from: the customer is told the order is refused.
  await sendNotification(to === "DENIED" ? "ORDER_DENIED" : "STOCK_ISSUE", {
    userId: order.userId,
    orderId: input.orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
    ...(to === "DENIED" && { denyReason: ALL_UNAVAILABLE_REASON }),
  });
  return {
    kind: "done",
    data: {
      order: outcome.order,
      alternatives: await findAlternatives(input.shopId, unavailableLines),
    },
  };
}

export type UnavailableDecision =
  | { orderItemId: string; action: "remove" }
  | { orderItemId: string; action: "replace"; replacementProductId: string };

/**
 * Customer: answers every pending out-of-stock line of a PARTIALLY_DENIED order. Back to PENDING
 * (the butcher decides again: no QR code, no estimate, a fresh acceptance deadline), or DENIED
 * when nothing is left.
 */
export async function resolveUnavailableItems(input: {
  orderId: string;
  userId: string;
  decisions: readonly UnavailableDecision[];
  now: Date;
}): Promise<CommandResult<Order>> {
  const scope = { userId: input.userId };
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, userId: input.userId },
    select: {
      shopId: true,
      discountCents: true,
      serviceFeeCents: true,
      user: { select: { role: true } },
      shop: { select: { acceptTimeoutMin: true } },
      items: { select: ITEM_SNAPSHOT_SELECT },
    },
  });
  if (order === null) return { kind: "not_found" };

  const pending = order.items.filter((item) => !item.available && item.replacement === null);
  const decisionByLine = new Map(
    input.decisions.map((decision) => [decision.orderItemId, decision])
  );
  if (
    decisionByLine.size !== input.decisions.length ||
    pending.length !== decisionByLine.size ||
    pending.some((line) => !decisionByLine.has(line.id))
  ) {
    return {
      kind: "refused",
      code: "VALIDATION_ERROR",
      message: "Choisissez une option pour chaque article en rupture",
    };
  }

  const replacementIds = input.decisions.flatMap((d) =>
    d.action === "replace" ? [d.replacementProductId] : []
  );
  const products = await prisma.product.findMany({
    where: { id: { in: replacementIds }, shopId: order.shopId },
    select: REPLACEMENT_SELECT,
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  const pricing = { isPro: order.user.role === "CLIENT_PRO", now: input.now };

  const changes: LineChange[] = [];
  for (const line of pending) {
    const decision = decisionByLine.get(line.id) as UnavailableDecision;
    if (decision.action === "remove") {
      changes.push({ id: line.id, remove: true });
      continue;
    }
    const change = replacementChange(line, productById.get(decision.replacementProductId), pricing);
    if (typeof change === "string")
      return { kind: "refused", code: "VALIDATION_ERROR", message: change };
    changes.push(change);
  }

  const replaced = changes.flatMap((change) =>
    change.remove ? [] : [{ totalCents: change.totalCents }]
  );
  const remaining = [...order.items.filter((item) => item.available), ...replaced];
  const to: OrderStatus = remaining.length === 0 ? "DENIED" : "PENDING";
  const data: Prisma.OrderUncheckedUpdateManyInput =
    to === "DENIED"
      ? { totalCents: totalAfter(remaining, order), denyReason: ALL_REMOVED_REASON }
      : {
          totalCents: totalAfter(remaining, order),
          denyReason: null,
          qrCode: null,
          estimatedReady: null,
          expiresAt: new Date(input.now.getTime() + order.shop.acceptTimeoutMin * MINUTE_MS),
        };

  let outcome;
  try {
    outcome = await transitionOrder({
      orderId: input.orderId,
      scope,
      from: ["PARTIALLY_DENIED"],
      to,
      data,
      event: {
        type: "ALTERNATIVES_CHOSEN",
        actorId: input.userId,
        payload: { decisions: input.decisions.map((d) => ({ ...d })), resultStatus: to },
      },
      effects: async (tx, changed) => {
        if (!sameLines(order.items, await readLines(tx, changed.id)))
          throw new StaleOrderError(changed.id);
        await closePendingAdjustment(tx, changed.id, changed.updatedAt);
        for (const change of changes) {
          await tx.orderItem.updateMany({
            where: { id: change.id, orderId: changed.id, available: false, replacement: null },
            data: change.remove ? { replacement: "removed" } : change.data,
          });
        }
        if (to === "DENIED") await releaseOrderDiscount(tx, changed);
      },
    });
  } catch (error) {
    if (error instanceof StaleOrderError) return STALE_ORDER_REFUSAL;
    throw error;
  }
  if (!outcome.ok) {
    // A PENDING or DENIED order is not a replay of these decisions: the lines were answered before.
    if (outcome.reason === "NOT_FOUND") return { kind: "not_found" };
    return { kind: "conflict", currentStatus: outcome.currentStatus };
  }
  return { kind: "done", data: outcome.order };
}
