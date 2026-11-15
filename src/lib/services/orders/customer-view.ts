// src/lib/services/orders/customer-view.ts — what a customer (signed-in or guest) reads of an order.
// An allow-list: an Order, OrderItem or Product column added to the schema is never sent to a
// customer until it is added here. The weighing tolerance frozen on the order (rate, cap and the
// estimated total it applies to) is the customer's own choice and is shown to him. Left out on
// purpose: commission and Stripe columns, the
// idempotency key, offer and loyalty references, the butcher's weighing columns of the lines, the
// product row (pro and boutique prices, stock, reference catalogue), the shop owner and every user
// identifier.
//
// The person an order names and the customer number it shows follow the rule every reader uses
// (order-person.ts): a guest order shows the identity typed at checkout, never the users row it is
// filed under, and no customer number (C1-INVITES).
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  orderCustomerNumber,
  orderPersonColumns,
  orderPersonName,
  splitOrderPerson,
} from "./order-person";

export const customerOrderSelect = {
  id: true,
  orderNumber: true,
  dailyNumber: true,
  displayNumber: true,
  customerNumber: true,
  status: true,
  isPro: true,
  requestedTime: true,
  estimatedReady: true,
  actualReady: true,
  pickedUpAt: true,
  pickupSlotStart: true,
  pickupSlotEnd: true,
  expiresAt: true,
  totalCents: true,
  discountCents: true,
  weighToleranceRateBps: true,
  weighToleranceCapCents: true,
  estimatedTotalCents: true,
  paymentMethod: true,
  paidAt: true,
  qrCode: true,
  rating: true,
  ratingComment: true,
  customerNote: true,
  boucherNote: true,
  denyReason: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      name: true,
      quantity: true,
      unit: true,
      priceCents: true,
      totalCents: true,
      weightGrams: true,
      itemNote: true,
      available: true,
      replacement: true,
      sliceCount: true,
      sliceThickness: true,
      variant: true,
      pieceCount: true,
      pieceLabel: true,
      cutOption: true,
      cutPriceCents: true,
      product: { select: { name: true, unit: true, imageUrl: true } },
    },
  },
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      address: true,
      city: true,
      phone: true,
    },
  },
  user: { select: { firstName: true, lastName: true } },
  priceAdjustment: {
    select: {
      id: true,
      originalTotal: true,
      newTotal: true,
      reason: true,
      adjustmentType: true,
      status: true,
      tier: true,
      itemsSnapshot: true,
      answerBy: true,
      closeReason: true,
      // Legacy columns, never written since C1-PAIEMENT-A: still read by the tracking page
      // (src/app/(client)/suivi/[id]/page.tsx) until C1-PAIEMENT-A-T7 drops them there.
      autoApproveAt: true,
      escalateAt: true,
      respondedAt: true,
      createdAt: true,
    },
  },
} as const satisfies Prisma.OrderSelect;

export type CustomerOrder = Prisma.OrderGetPayload<{ select: typeof customerOrderSelect }>;

/** What the queries read: the allow-list, plus the columns that decide whom the order names. */
const customerOrderQuery = {
  ...customerOrderSelect,
  ...orderPersonColumns,
} as const satisfies Prisma.OrderSelect;

type CustomerOrderRow = Prisma.OrderGetPayload<{ select: typeof customerOrderQuery }>;

/** The row as the customer reads it: the person resolved, the deciding columns left out. */
function toCustomerOrder(row: CustomerOrderRow): CustomerOrder {
  const { order, person } = splitOrderPerson(row);
  return {
    ...order,
    user: orderPersonName({ ...person, user: order.user }),
    customerNumber: orderCustomerNumber({ ...person, customerNumber: order.customerNumber }),
  };
}

/** The order matching `where` (which carries the caller's ownership), or null. */
export async function findCustomerOrder(
  where: Prisma.OrderWhereInput
): Promise<CustomerOrder | null> {
  const row = await prisma.order.findFirst({ where, select: customerOrderQuery });
  return row === null ? null : toCustomerOrder(row);
}

/** The orders matching `where`, newest first, at most `take`. */
export async function listCustomerOrders(
  where: Prisma.OrderWhereInput,
  take: number
): Promise<CustomerOrder[]> {
  const rows = await prisma.order.findMany({
    where,
    select: customerOrderQuery,
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toCustomerOrder);
}

/** The customer view of an order the caller has just created or changed within its own scope. */
export async function customerOrderById(orderId: string): Promise<CustomerOrder> {
  const row = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: customerOrderQuery,
  });
  return toCustomerOrder(row);
}
