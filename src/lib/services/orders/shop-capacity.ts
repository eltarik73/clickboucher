// src/lib/services/orders/shop-capacity.ts — can the shop take one more order right now?
//
// Shop status (open or busy), orders of the last hour against the hourly cap, and orders of the
// requested pickup slot against the slot capacity. Cancelled, denied and auto-cancelled orders do
// not count.
//
// Guest orders the shop has not acted on (GUEST_ORDER_AWAITING_SHOP) are anyone's to place, with
// any e-mail: they never take the capacity of the other customers, and are bounded on their own
// instead. A new guest order is refused once the guest orders awaiting the shop reach the same
// hourly or slot maximum, so a flood of them can block further guest orders, never a signed-in
// customer nor an order the butcher has accepted. They join the common count once the butcher
// accepts them or moves them on.
import type { OrderStatus, Prisma, ShopStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import { GUEST_ORDER_AWAITING_SHOP } from "@/lib/auth/guest-auth";
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

/** Orders of `scope` that take capacity from every customer. */
function countCommonLoad(scope: Prisma.OrderWhereInput): Promise<number> {
  return prisma.order.count({
    where: {
      AND: [scope, { status: { notIn: NOT_COUNTED } }, { NOT: GUEST_ORDER_AWAITING_SHOP }],
    },
  });
}

/** Guest orders of `scope` the shop has not acted on yet. */
function countGuestsAwaiting(scope: Prisma.OrderWhereInput): Promise<number> {
  return prisma.order.count({ where: { AND: [scope, GUEST_ORDER_AWAITING_SHOP] } });
}

export async function checkShopCanTakeOrder(
  shop: { id: string; maxOrdersPerHour: number; maxOrdersPerSlot: number },
  request: { pickupSlotStart?: string },
  now: Date,
  placement: { asGuest: boolean }
): Promise<ShopCapacity> {
  const slotStart = request.pickupSlotStart ? new Date(request.pickupSlotStart) : null;
  const lastHour: Prisma.OrderWhereInput = {
    shopId: shop.id,
    createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
  };
  const slot: Prisma.OrderWhereInput | null =
    slotStart === null ? null : { shopId: shop.id, pickupSlotStart: slotStart };

  const [currentStatus, hourLoad, slotLoad, hourGuests, slotGuests] = await Promise.all([
    getShopStatus(shop.id),
    countCommonLoad(lastHour),
    slot === null ? 0 : countCommonLoad(slot),
    placement.asGuest ? countGuestsAwaiting(lastHour) : 0,
    placement.asGuest && slot !== null ? countGuestsAwaiting(slot) : 0,
  ]);

  if (currentStatus !== "OPEN" && currentStatus !== "BUSY") {
    return {
      ok: false,
      code: "SERVICE_DISABLED",
      message: UNAVAILABLE_MESSAGES[currentStatus],
    };
  }
  if (Math.max(hourLoad, hourGuests) >= shop.maxOrdersPerHour) {
    return {
      ok: false,
      code: "CAPACITY_EXCEEDED",
      message: "La boutique est temporairement surchargée",
    };
  }
  if (slot !== null && Math.max(slotLoad, slotGuests) >= shop.maxOrdersPerSlot) {
    return { ok: false, code: "CAPACITY_EXCEEDED", message: "Ce créneau est complet" };
  }
  return { ok: true };
}
