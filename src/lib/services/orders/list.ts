import type { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { orderListQuerySchema } from "@/lib/validators";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { autoApproveExpiredAdjustment } from "@/lib/price-adjustment";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";

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

const orderInclude = {
  items: { include: { product: { select: { name: true, unit: true, vatRate: true, imageUrl: true } } } },
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
  user: { select: { firstName: true, lastName: true, customerNumber: true, phone: true, loyaltyBadge: true } },
  priceAdjustment: true,
} as const;

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

  const where: Record<string, unknown> = {};

  if (query.status) {
    if (!VALID_STATUSES.includes(query.status as (typeof VALID_STATUSES)[number])) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Statut de commande invalide" };
    }
    where.status = query.status;
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

  const orders = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Auto-approve expired price adjustments (batch instead of N+1)
  const expiredAdjustmentOrderIds = orders
    .filter((order) => {
      const adj = (order as Record<string, unknown>).priceAdjustment as
        | { status?: string; autoApproveAt?: Date }
        | null;
      return adj?.status === "PENDING" && adj.autoApproveAt && new Date() >= new Date(adj.autoApproveAt);
    })
    .map((o) => o.id);

  if (expiredAdjustmentOrderIds.length > 0) {
    await Promise.all(expiredAdjustmentOrderIds.map((id) => autoApproveExpiredAdjustment(id)));

    const refreshed = await prisma.order.findMany({
      where: { id: { in: expiredAdjustmentOrderIds } },
      include: orderInclude,
    });
    const refreshedMap = new Map(refreshed.map((o) => [o.id, o]));
    const mergedOrders = orders.map((o) => refreshedMap.get(o.id) || o);
    return { ok: true, orders: mergedOrders };
  }

  return { ok: true, orders };
}
