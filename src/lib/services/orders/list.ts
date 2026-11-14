import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { orderListQuerySchema } from "@/lib/validators";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { settleDueAdjustmentsWithin } from "@/lib/services/orders/adjustment-answers";
import { listCustomerOrders } from "@/lib/services/orders/customer-view";
import { orderInclude } from "@/lib/services/orders/order-read";

/** The user-visible orders page: newest first. */
const LIST_LIMIT = 50;

const VALID_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "COMPLETED",
  "CANCELLED",
  "AUTO_CANCELLED",
  "DENIED",
] as const;

export type ListOrdersResult =
  | { ok: true; orders: unknown[] }
  | { ok: false; code: "UNAUTHORIZED" | "VALIDATION_ERROR"; message: string };

/**
 * List orders for the currently authenticated user.
 * Role-based:
 *  - CLIENT → own orders
 *  - BOUCHER → orders for their shop(s)
 *  - ADMIN → all orders (optionally filtered by shopId)
 */
export async function listOrders(userId: string, req: NextRequest): Promise<ListOrdersResult> {
  const user = await getOrCreateUser(userId);
  if (!user) {
    return { ok: true, orders: [] };
  }

  const role = user.role;
  const raw = Object.fromEntries(req.nextUrl.searchParams);
  const query = orderListQuerySchema.parse(raw);

  const where: Prisma.OrderWhereInput = {};

  if (query.status) {
    const status = VALID_STATUSES.find((candidate) => candidate === query.status);
    if (status === undefined) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Statut de commande invalide" };
    }
    where.status = status;
  }

  if (role === "ADMIN") {
    if (query.shopId) where.shopId = query.shopId;
  } else if (role === "BOUCHER") {
    const boucherAuth = await getAuthenticatedBoucher();
    if (boucherAuth.error) {
      // Fallback: search by clerkId and DB userId (OR clause ownership)
      const shops = await prisma.shop.findMany({
        where: { OR: [{ ownerId: userId }, { ownerId: user.id }] },
        select: { id: true },
      });
      const shopIds = shops.map((s) => s.id);
      if (query.shopId && shopIds.includes(query.shopId)) {
        where.shopId = query.shopId;
      } else {
        where.shopId = { in: shopIds };
      }
    } else {
      const shopId = boucherAuth.shopId;
      if (query.shopId && query.shopId === shopId) {
        where.shopId = query.shopId;
      } else {
        where.shopId = shopId;
      }
    }
  } else {
    where.userId = user.id;
  }

  // Due price adjustments are settled first, within the caller's own scope, so the list shows
  // settled totals.
  await settleDueAdjustmentsWithin(where, new Date());

  // A customer reads the customer view of their orders; the shop and the admin read the full rows.
  if (role !== "ADMIN" && role !== "BOUCHER") {
    return { ok: true, orders: await listCustomerOrders(where, LIST_LIMIT) };
  }
  const orders = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
  return { ok: true, orders };
}
