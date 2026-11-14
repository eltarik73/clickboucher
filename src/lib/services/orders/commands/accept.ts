// src/lib/services/orders/commands/accept.ts — the butcher accepts an order.
import { randomUUID } from "crypto";
import type { Order } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calculatePrepTime } from "@/lib/dynamic-prep-time";
import { sendNotification } from "@/lib/notifications";
import { storedLineUnits } from "@/lib/pricing/line";
import { LimitedStockError, reserveLimitedStock } from "@/lib/services/orders/limited-stock";
import { transitionOrderInTx } from "@/lib/services/orders/transition";
import { unappliedTransition, type CommandResult } from "./outcome";
import {
  ACCEPTED_EVENT_TYPE,
  stockLinesOfOrder,
  stockUnitsPayload,
} from "@/lib/services/orders/stock-hold";

const MINUTE_MS = 60_000;
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

export interface AcceptOrderInput {
  orderId: string;
  shopId: string;
  actorId: string;
  /** Preparation time chosen by the butcher; ignored for a scheduled order. */
  estimatedMinutes: number;
  now: Date;
}

/**
 * PENDING or PARTIALLY_DENIED -> ACCEPTED. Reserves the limited stock of the available lines in
 * the same transaction and records the units in the ACCEPTED event: an underflow refuses the
 * acceptance and leaves the order unchanged.
 */
export async function acceptOrder(input: AcceptOrderInput): Promise<CommandResult<Order>> {
  const scope = { shopId: input.shopId };
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, shopId: input.shopId },
    select: {
      orderNumber: true,
      userId: true,
      qrCode: true,
      pickupSlotStart: true,
      items: { select: { unit: true, quantity: true, weightGrams: true, available: true } },
      shop: { select: { name: true, prepTimeMin: true, busyMode: true, busyExtraMin: true } },
    },
  });
  if (order === null) return { kind: "not_found" };

  const itemCount = order.items
    .filter((item) => item.available)
    .reduce((sum, item) => sum + storedLineUnits(item), 0);
  const prepMinutes = await calculatePrepTime({
    shopId: input.shopId,
    basePrepMin: order.shop.prepTimeMin,
    busyMode: order.shop.busyMode,
    busyExtraMin: order.shop.busyExtraMin,
    itemCount,
  });

  // A scheduled order is ready at its pickup slot: the butcher does not choose a delay.
  const slotStart = order.pickupSlotStart;
  const scheduled = slotStart !== null && slotStart.getTime() > input.now.getTime();
  const estimatedMinutes = scheduled
    ? Math.round((slotStart.getTime() - input.now.getTime()) / MINUTE_MS)
    : Math.max(input.estimatedMinutes, prepMinutes);
  const estimatedReady = scheduled
    ? slotStart
    : new Date(input.now.getTime() + estimatedMinutes * MINUTE_MS);
  const qrCode = order.qrCode ?? randomUUID();

  let outcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      // Under the order's row lock the lines cannot change: the units recorded in the event are
      // exactly the units reserved, and the release gives back the same units.
      await tx.$queryRaw`SELECT 1 FROM "orders" WHERE "id" = ${input.orderId} AND "shop_id" = ${input.shopId} FOR UPDATE`;
      const stockUnits = await stockLinesOfOrder(tx, input.orderId);
      return transitionOrderInTx(tx, {
        orderId: input.orderId,
        scope,
        from: ["PENDING", "PARTIALLY_DENIED"],
        to: "ACCEPTED",
        data: { estimatedReady, qrCode, expiresAt: null },
        event: {
          type: ACCEPTED_EVENT_TYPE,
          actorId: input.actorId,
          payload: { estimatedMinutes, qrCode, ...stockUnitsPayload(stockUnits) },
        },
        effects: (effectTx, accepted) => reserveLimitedStock(effectTx, accepted.shopId, stockUnits),
      });
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof LimitedStockError) {
      return {
        kind: "refused",
        code: "STOCK_INSUFFICIENT",
        message: "Stock insuffisant pour cette commande (rupture détectée pendant l'acceptation)",
      };
    }
    throw error;
  }
  if (!outcome.ok)
    return unappliedTransition(outcome, { orderId: input.orderId, scope, to: "ACCEPTED" });

  await sendNotification("ORDER_ACCEPTED", {
    userId: order.userId,
    orderId: input.orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
    estimatedMinutes,
    qrCode,
  });
  return { kind: "done", data: outcome.order };
}
