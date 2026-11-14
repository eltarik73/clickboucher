// src/lib/services/orders/commands/progress.ts — the butcher moves an accepted order forward:
// preparation, ready, pickup; and the two writes without a status change (time, note).
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { closePendingAdjustment } from "@/lib/services/orders/adjustment-settlement";
import { transitionOrder } from "@/lib/services/orders/transition";
import { unappliedTransition, type CommandResult } from "./outcome";
import { sendPickupReceipt } from "./pickup-receipt";

const MINUTE_MS = 60_000;
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

interface ShopCommand {
  orderId: string;
  shopId: string;
  actorId: string;
  now: Date;
}

async function readForNotification(orderId: string, shopId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, shopId },
    select: {
      orderNumber: true,
      userId: true,
      estimatedReady: true,
      shop: { select: { name: true } },
    },
  });
}

/** ACCEPTED -> PREPARING; `addMinutes` pushes the estimated ready time. */
export async function startPreparing(
  input: ShopCommand & { addMinutes?: number }
): Promise<CommandResult<Order>> {
  const scope = { shopId: input.shopId };
  const order = await readForNotification(input.orderId, input.shopId);
  if (order === null) return { kind: "not_found" };

  const addMinutes = input.addMinutes ?? 0;
  const data: Prisma.OrderUncheckedUpdateManyInput = {};
  if (addMinutes > 0) {
    const base = order.estimatedReady ?? input.now;
    data.estimatedReady = new Date(base.getTime() + addMinutes * MINUTE_MS);
  }

  const outcome = await transitionOrder({
    orderId: input.orderId,
    scope,
    from: ["ACCEPTED"],
    to: "PREPARING",
    data,
    event: { type: "PREPARING", actorId: input.actorId, payload: { addMinutes } },
  });
  if (!outcome.ok)
    return unappliedTransition(outcome, { orderId: input.orderId, scope, to: "PREPARING" });

  await sendNotification("ORDER_PREPARING", {
    userId: order.userId,
    orderId: input.orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
  });
  return { kind: "done", data: outcome.order };
}

/** ACCEPTED or PREPARING -> READY. */
export async function markReady(input: ShopCommand): Promise<CommandResult<Order>> {
  const scope = { shopId: input.shopId };
  const order = await readForNotification(input.orderId, input.shopId);
  if (order === null) return { kind: "not_found" };

  const outcome = await transitionOrder({
    orderId: input.orderId,
    scope,
    from: ["ACCEPTED", "PREPARING"],
    to: "READY",
    data: { actualReady: input.now },
    event: { type: "READY", actorId: input.actorId },
  });
  if (!outcome.ok)
    return unappliedTransition(outcome, { orderId: input.orderId, scope, to: "READY" });

  await sendNotification("ORDER_READY", {
    userId: order.userId,
    orderId: input.orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
  });
  return { kind: "done", data: outcome.order };
}

/** The order is designated by its id (kitchen actions) or by its QR code alone (scanner). */
export type PickupTarget =
  | { orderId: string; qrCode: string | null }
  | { orderId?: undefined; qrCode: string };

const INVALID_QR: CommandResult<never> = {
  kind: "refused",
  code: "VALIDATION_ERROR",
  message: "QR code invalide",
};

/**
 * READY -> PICKED_UP: the one path of the QR action, the manual action and the scanner route.
 * With a QR code, the code is a condition of the write itself.
 */
export async function confirmPickup(
  input: Omit<ShopCommand, "orderId"> & { target: PickupTarget }
): Promise<CommandResult<Order>> {
  const scope = { shopId: input.shopId };
  const { qrCode } = input.target;
  const lookup: Prisma.OrderWhereInput =
    input.target.orderId === undefined
      ? { qrCode: input.target.qrCode, shopId: input.shopId }
      : { id: input.target.orderId, shopId: input.shopId };
  const order = await prisma.order.findFirst({
    where: lookup,
    select: {
      id: true,
      qrCode: true,
      orderNumber: true,
      userId: true,
      shop: { select: { name: true } },
    },
  });
  if (order === null) return { kind: "not_found" };
  if (qrCode !== null && order.qrCode !== qrCode) return INVALID_QR;

  const method = qrCode === null ? "manual" : "qr";
  const outcome = await transitionOrder({
    orderId: order.id,
    scope,
    from: ["READY"],
    to: "PICKED_UP",
    where: qrCode === null ? undefined : { qrCode },
    data:
      qrCode === null
        ? { pickedUpAt: input.now }
        : { pickedUpAt: input.now, qrScannedAt: input.now },
    event: { type: "PICKED_UP", actorId: input.actorId, payload: { method } },
    // The customer pays the total of the pickup: an adjustment still pending is no longer applied.
    effects: (tx, pickedUp) => closePendingAdjustment(tx, pickedUp.id, input.now),
  });
  if (!outcome.ok) {
    // Still READY after a refused write: only the QR condition can have failed.
    if (outcome.reason === "CONFLICT" && outcome.currentStatus === "READY") return INVALID_QR;
    return unappliedTransition(outcome, { orderId: order.id, scope, to: "PICKED_UP" });
  }

  await sendNotification("ORDER_PICKED_UP", {
    userId: order.userId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
  });
  await sendPickupReceipt(order.id, input.now);
  return { kind: "done", data: outcome.order };
}

const TIME_STATUSES: readonly OrderStatus[] = ["ACCEPTED", "PREPARING"];
const NOTE_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "PARTIALLY_DENIED",
];

/**
 * Scoped conditional write without a status change, with its OrderEvent, in one transaction.
 * `compute` reads the order under its row lock, so concurrent writes of the same order apply one
 * after the other instead of overwriting each other.
 */
async function writeWithoutTransition(
  input: ShopCommand,
  allowed: readonly OrderStatus[],
  compute: (current: Order) => Omit<Prisma.OrderUncheckedUpdateManyInput, "status">,
  event: { type: string; payload: Prisma.InputJsonObject }
): Promise<CommandResult<Order>> {
  return prisma.$transaction(async (tx): Promise<CommandResult<Order>> => {
    await tx.$queryRaw`SELECT 1 FROM "orders" WHERE "id" = ${input.orderId} AND "shop_id" = ${input.shopId} FOR UPDATE`;
    const current = await tx.order.findFirst({
      where: { id: input.orderId, shopId: input.shopId },
    });
    if (current === null) return { kind: "not_found" };
    if (!allowed.includes(current.status))
      return { kind: "conflict", currentStatus: current.status };

    const guard: Prisma.OrderWhereInput = {
      id: input.orderId,
      shopId: input.shopId,
      status: { in: [...allowed] },
    };
    const { count } = await tx.order.updateMany({ where: guard, data: compute(current) });
    if (count !== 1)
      throw new Error(`Order ${input.orderId}: ${count} rows written under its row lock`);
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        shopId: input.shopId,
        type: event.type,
        actorId: input.actorId,
        payloadJson: event.payload,
      },
    });
    return {
      kind: "done",
      data: await tx.order.findUniqueOrThrow({ where: { id: input.orderId } }),
    };
  }, TRANSACTION_OPTIONS);
}

/** Pushes the estimated ready time of an ACCEPTED or PREPARING order. */
export async function addTime(
  input: ShopCommand & { addMinutes: number }
): Promise<CommandResult<Order>> {
  return writeWithoutTransition(
    input,
    TIME_STATUSES,
    (current) => ({
      estimatedReady: new Date(
        (current.estimatedReady ?? input.now).getTime() + input.addMinutes * MINUTE_MS
      ),
    }),
    { type: "ADD_TIME", payload: { addMinutes: input.addMinutes } }
  );
}

/** Butcher's note on an order that is not finished; the customer is told. */
export async function addNote(
  input: ShopCommand & { note: string }
): Promise<CommandResult<Order>> {
  const result = await writeWithoutTransition(
    input,
    NOTE_STATUSES,
    () => ({ boucherNote: input.note }),
    { type: "ADD_NOTE", payload: { note: input.note } }
  );
  if (result.kind !== "done") return result;

  const order = await readForNotification(input.orderId, input.shopId);
  if (order !== null) {
    await sendNotification("BOUCHER_NOTE", {
      userId: order.userId,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      note: input.note,
    });
  }
  return result;
}
