// src/lib/services/orders/customer-view.ts — what a customer (signed-in or guest) reads of an order.
// An allow-list: an Order, OrderItem or Product column added to the schema is never sent to a
// customer until it is added here. Left out on purpose: commission and Stripe columns, the
// idempotency key, offer and loyalty references, the butcher's weighing columns of the lines, the
// product row (pro and boutique prices, stock, reference catalogue), the shop owner and every user
// identifier.
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

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
      autoApproveAt: true,
      escalateAt: true,
      respondedAt: true,
      createdAt: true,
    },
  },
} as const satisfies Prisma.OrderSelect;

export type CustomerOrder = Prisma.OrderGetPayload<{ select: typeof customerOrderSelect }>;

/** The order matching `where` (which carries the caller's ownership), or null. */
export async function findCustomerOrder(
  where: Prisma.OrderWhereInput
): Promise<CustomerOrder | null> {
  return prisma.order.findFirst({ where, select: customerOrderSelect });
}

/** The orders matching `where`, newest first, at most `take`. */
export async function listCustomerOrders(
  where: Prisma.OrderWhereInput,
  take: number
): Promise<CustomerOrder[]> {
  return prisma.order.findMany({
    where,
    select: customerOrderSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** The customer view of an order the caller has just created or changed within its own scope. */
export async function customerOrderById(orderId: string): Promise<CustomerOrder> {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: customerOrderSelect });
}
