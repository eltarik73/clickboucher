// src/lib/services/orders/order-read.ts — the order rows the shop-side lists of GET /api/orders
// return (butcher and admin). Customers read src/lib/services/orders/customer-view.ts instead; the
// kitchen board reads its own narrower columns (src/lib/services/orders/kitchen.ts).
import type { Order } from "@prisma/client";

import {
  orderCustomerNumber,
  shopOrderPerson,
  shopPersonSelect,
  splitOrderPerson,
  type ShopPerson,
} from "./order-person";

export const orderInclude = {
  items: {
    include: { product: { select: { name: true, unit: true, vatRate: true, imageUrl: true } } },
  },
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      address: true,
      city: true,
      siret: true,
      fullAddress: true,
      vatRate: true,
      priceAdjustmentThreshold: true,
    },
  },
  user: { select: shopPersonSelect },
  priceAdjustment: true,
} as const;

/** Columns a shop list never sends: the hash of a guest order's credential. */
export const orderOmit = { accessTokenHash: true } as const;

/**
 * A row as the shop and the admin read it: the person the order names and the number it shows
 * (order-person.ts), the columns that decide them left out.
 */
export function toShopOrder<T extends Omit<Order, keyof typeof orderOmit> & { user: ShopPerson }>(
  row: T
) {
  const { order, person } = splitOrderPerson(row);
  return {
    ...order,
    customerNumber: orderCustomerNumber({ ...person, customerNumber: order.customerNumber }),
    user: shopOrderPerson({ ...person, user: order.user }),
  };
}
