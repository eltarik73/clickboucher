// src/lib/services/orders/shop-capacity.ts — can the shop take one more order right now?
//
// Shop status (open or busy), orders of the last hour against the hourly cap, and orders of the
// requested pickup slot against the slot capacity. Cancelled, denied and auto-cancelled orders do
// not count.
import type { OrderStatus, ShopStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getShopStatus } from "@/lib/shop-status";

const HOUR_MS = 60 * 60 * 1000;
const NOT_COUNTED: OrderStatus[] = ["CANCELLED", "AUTO_CANCELLED", "DENIED"];

const UNAVAILABLE_MESSAGES: Record<Exclude<ShopStatus, "OPEN" | "BUSY">, string> = {
  PAUSED: "La boucherie a temporairement mis les commandes en pause",
  AUTO_PAUSED: "La boucherie est temporairement indisponible",
  CLOSED: "La boucherie est actuellement fermée",
  VACATION: "La boucherie est en vacances",
};

export type ShopCapacity =
  | { ok: true }
  | { ok: false; code: "SERVICE_DISABLED" | "CAPACITY_EXCEEDED"; message: string };

export async function checkShopCanTakeOrder(
  shop: { id: string; maxOrdersPerHour: number; maxOrdersPerSlot: number },
  request: { pickupSlotStart?: string },
  now: Date
): Promise<ShopCapacity> {
  const slotStart = request.pickupSlotStart ? new Date(request.pickupSlotStart) : null;

  const [currentStatus, ordersLastHour, ordersInSlot] = await Promise.all([
    getShopStatus(shop.id),
    prisma.order.count({
      where: {
        shopId: shop.id,
        createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
        status: { notIn: NOT_COUNTED },
      },
    }),
    slotStart === null
      ? Promise.resolve(0)
      : prisma.order.count({
          where: { shopId: shop.id, pickupSlotStart: slotStart, status: { notIn: NOT_COUNTED } },
        }),
  ]);

  if (currentStatus !== "OPEN" && currentStatus !== "BUSY") {
    return {
      ok: false,
      code: "SERVICE_DISABLED",
      message: UNAVAILABLE_MESSAGES[currentStatus],
    };
  }
  if (ordersLastHour >= shop.maxOrdersPerHour) {
    return {
      ok: false,
      code: "CAPACITY_EXCEEDED",
      message: "La boutique est temporairement surchargée",
    };
  }
  if (slotStart !== null && ordersInSlot >= shop.maxOrdersPerSlot) {
    return { ok: false, code: "CAPACITY_EXCEEDED", message: "Ce créneau est complet" };
  }
  return { ok: true };
}
