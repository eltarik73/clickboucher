// src/lib/services/orders/order-shop.ts — the shop row an order is quoted and created from:
// throttling and preparation settings, minimum order, commission, and the publication facts
// (src/lib/shop-publication.ts) that decide whether the shop takes orders at all; and the check
// of those facts again, under a row lock, inside the transaction that writes the order.
import type { Prisma } from "@prisma/client";

import {
  SHOP_UNAVAILABLE_MESSAGE,
  shopOrderRefusalMessage,
  shopPublicationSelect,
} from "@/lib/shop-publication";

export const orderShopSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  autoAccept: true,
  acceptTimeoutMin: true,
  busyMode: true,
  busyExtraMin: true,
  prepTimeMin: true,
  maxOrdersPerSlot: true,
  maxOrdersPerHour: true,
  autoBusyThreshold: true,
  minOrderCents: true,
  commissionPct: true,
  commissionEnabled: true,
  ...shopPublicationSelect,
} satisfies Prisma.ShopSelect;

export type OrderShop = Prisma.ShopGetPayload<{ select: typeof orderShopSelect }>;

/** Thrown inside the creation transaction when the shop stopped taking orders after the quote. */
export class ShopStoppedTakingOrdersError extends Error {
  constructor(readonly refusal: string) {
    super(refusal);
    this.name = "ShopStoppedTakingOrdersError";
  }
}

type PublicationRow = { visible: boolean; suspended_at: Date | null; vacation_mode: boolean };

/**
 * Takes a shared lock on the shop row and reads its publication facts again under it. The lock
 * conflicts with every UPDATE of the row: a suspension, an unpublication or a vacation committed
 * after the quote is seen here, and one requested while the order is being written waits for its
 * commit, so the order is older than the decision. Concurrent orders of the shop share the lock.
 * First lock of the creation transaction: it never waits while holding another one.
 */
export async function lockShopTakingOrders(
  tx: Prisma.TransactionClient,
  shopId: string
): Promise<void> {
  const [row] = await tx.$queryRaw<PublicationRow[]>`
    SELECT "visible", "suspended_at", "vacation_mode" FROM "shops" WHERE "id" = ${shopId} FOR SHARE`;
  const refusal =
    row === undefined
      ? SHOP_UNAVAILABLE_MESSAGE
      : shopOrderRefusalMessage({
          visible: row.visible,
          suspendedAt: row.suspended_at,
          vacationMode: row.vacation_mode,
        });
  if (refusal !== null) throw new ShopStoppedTakingOrdersError(refusal);
}
