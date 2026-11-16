// src/lib/services/orders/list.ts — the orders page of GET /api/orders. The route resolves who reads
// (OrderListViewer); a customer reads the customer view of their own orders, a butcher the orders of
// their shops, an admin every order. The query narrows the viewer's scope, never widens it.
import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import prisma from "@/lib/prisma";
import type { orderListQuerySchema } from "@/lib/validators";
import { settleDueAdjustmentsWithin } from "@/lib/services/orders/adjustment-answers";
import { listCustomerOrders, type CustomerOrder } from "@/lib/services/orders/customer-view";
import { orderInclude, orderOmit, toShopOrder } from "@/lib/services/orders/order-read";

/** The user-visible orders page: newest first. */
const LIST_LIMIT = 50;

export type OrderListViewer =
  | { role: "ADMIN" }
  | { role: "BOUCHER"; shopIds: readonly string[] }
  | { role: "CLIENT"; userId: string };

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

type ShopOrderRow = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
  omit: typeof orderOmit;
}>;
type ShopOrder = ReturnType<typeof toShopOrder<ShopOrderRow>>;

export type ListedOrders = CustomerOrder[] | ShopOrder[];

function listWhere(viewer: OrderListViewer, query: OrderListQuery): Prisma.OrderWhereInput {
  switch (viewer.role) {
    case "ADMIN":
      return { status: query.status, shopId: query.shopId };
    case "BOUCHER":
      return {
        status: query.status,
        shopId:
          query.shopId !== undefined && viewer.shopIds.includes(query.shopId)
            ? query.shopId
            : { in: [...viewer.shopIds] },
      };
    case "CLIENT":
      return { status: query.status, userId: viewer.userId };
  }
}

export async function listOrders(
  viewer: OrderListViewer,
  query: OrderListQuery,
  now: Date
): Promise<ListedOrders> {
  const where = listWhere(viewer, query);
  // Due price adjustments are settled first, within the viewer's own scope, so the list shows
  // settled totals.
  await settleDueAdjustmentsWithin(where, now);

  if (viewer.role === "CLIENT") return listCustomerOrders(where, LIST_LIMIT);
  const rows = await prisma.order.findMany({
    where,
    include: orderInclude,
    omit: orderOmit,
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
  return rows.map(toShopOrder);
}
