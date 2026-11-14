// src/lib/services/orders/kitchen.ts — read model of the kitchen board (mode cuisine).
// The board must show every order the shop still has to handle, however many finished orders
// are newer: active orders are read in full (up to a safety cap that is reported, never silent).
// The board is polled every few seconds all day long, so each row carries only the columns the
// kitchen renders, and the recent history is a separate, lighter read the client asks for rarely.
// Every row names the person the order names (order-person.ts): the ticket, the card and the alert
// print it, so a guest order shows the identity typed at checkout, never its users row.
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { KITCHEN_ACTIVE_STATUSES, KITCHEN_HISTORY_STATUSES } from "@/lib/order-state-machine";
import { settleDueAdjustmentsWithin } from "@/lib/services/orders/adjustment-answers";
import {
  orderCustomerNumber,
  orderPersonColumns,
  shopOrderPerson,
  shopPersonSelect,
  splitOrderPerson,
  withOrderPersonName,
} from "@/lib/services/orders/order-person";
import type { KitchenHistoryOrder, KitchenOrder } from "@/hooks/use-order-polling";

type KitchenItem = KitchenOrder["items"][number];
type Columns<T> = Record<keyof T, unknown>;

// Every member of the client's KitchenOrder is selected (checked by `satisfies`); the exact column
// list, with nothing more, is pinned by tests/integration/orders/kitchen-board.test.ts.
export const kitchenOrderSelect = {
  id: true,
  orderNumber: true,
  displayNumber: true,
  status: true,
  totalCents: true,
  discountCents: true,
  customerNumber: true,
  isPro: true,
  customerNote: true,
  requestedTime: true,
  estimatedReady: true,
  actualReady: true,
  qrCode: true,
  paymentMethod: true,
  pickupSlotStart: true,
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
      sliceCount: true,
      sliceThickness: true,
      variant: true,
      pieceCount: true,
      pieceLabel: true,
      cutOption: true,
      available: true,
      product: { select: { name: true, unit: true, imageUrl: true } },
    } satisfies Columns<KitchenItem>,
  },
  user: { select: shopPersonSelect },
  priceAdjustment: {
    select: {
      id: true,
      status: true,
      originalTotal: true,
      newTotal: true,
      reason: true,
      adjustmentType: true,
    },
  },
} as const satisfies Prisma.OrderSelect & Columns<KitchenOrder>;

/** A finished order as the history list prints it. */
export const kitchenHistorySelect = {
  id: true,
  orderNumber: true,
  displayNumber: true,
  status: true,
  totalCents: true,
  updatedAt: true,
  items: { select: { quantity: true } },
  user: { select: { firstName: true, lastName: true } },
} as const satisfies Prisma.OrderSelect & Columns<KitchenHistoryOrder>;

export type KitchenRow = Prisma.OrderGetPayload<{ select: typeof kitchenOrderSelect }>;
export type KitchenHistoryRow = Prisma.OrderGetPayload<{ select: typeof kitchenHistorySelect }>;

const kitchenOrderQuery = {
  ...kitchenOrderSelect,
  ...orderPersonColumns,
} as const satisfies Prisma.OrderSelect;
const kitchenHistoryQuery = {
  ...kitchenHistorySelect,
  ...orderPersonColumns,
} as const satisfies Prisma.OrderSelect;

function toKitchenRow(
  row: Prisma.OrderGetPayload<{ select: typeof kitchenOrderQuery }>
): KitchenRow {
  const { order, person } = splitOrderPerson(row);
  return {
    ...order,
    customerNumber: orderCustomerNumber({ ...person, customerNumber: order.customerNumber }),
    user: shopOrderPerson({ ...person, user: order.user }),
  };
}

export interface KitchenBoard {
  active: KitchenRow[];
  /** More active orders exist than `activeLimit`: the oldest ones are not in `active`. */
  activeTruncated: boolean;
}

export const DEFAULT_KITCHEN_ACTIVE_LIMIT = 500;
const HISTORY_LIMIT = 50;
const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function getKitchenBoard(
  shopId: string,
  options: { activeLimit?: number } = {}
): Promise<KitchenBoard> {
  const activeLimit = options.activeLimit ?? DEFAULT_KITCHEN_ACTIVE_LIMIT;
  const activeWhere = { shopId, status: { in: [...KITCHEN_ACTIVE_STATUSES] } };

  // Due price adjustments of active orders are settled first, so the board reads settled totals.
  // Finished orders are not settled: their adjustment can no longer change them.
  await settleDueAdjustmentsWithin(activeWhere, new Date());

  const activeRows = await prisma.order.findMany({
    where: activeWhere,
    select: kitchenOrderQuery,
    orderBy: { createdAt: "desc" },
    take: activeLimit + 1,
  });

  return {
    active: activeRows.slice(0, activeLimit).map(toKitchenRow),
    activeTruncated: activeRows.length > activeLimit,
  };
}

/** The 50 most recently updated finished orders of the last 7 days. */
export async function getKitchenHistory(shopId: string): Promise<KitchenHistoryRow[]> {
  const historySince = new Date(Date.now() - HISTORY_WINDOW_MS);
  const rows = await prisma.order.findMany({
    where: {
      shopId,
      status: { in: [...KITCHEN_HISTORY_STATUSES] },
      updatedAt: { gte: historySince },
    },
    select: kitchenHistoryQuery,
    orderBy: { updatedAt: "desc" },
    take: HISTORY_LIMIT,
  });
  return rows.map(withOrderPersonName);
}

/** The orders the live stream announces as new (ids not announced yet), as the alert shows them. */
export async function getNewOrderAlerts(shopId: string, orderIds: string[]) {
  const rows = await prisma.order.findMany({
    where: { shopId, id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      totalCents: true,
      createdAt: true,
      expiresAt: true,
      customerNote: true,
      pickupSlotStart: true,
      pickupSlotEnd: true,
      items: { select: { name: true, quantity: true, unit: true, priceCents: true } },
      user: { select: { firstName: true, lastName: true } },
      ...orderPersonColumns,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(withOrderPersonName);
}

export async function countPendingOrders(shopId: string): Promise<number> {
  return prisma.order.count({ where: { shopId, status: "PENDING" } });
}
