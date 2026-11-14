export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerUserId, getBoucherOwnerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { settleDueAdjustment } from "@/lib/services/orders/adjustment-answers";
import { findCustomerOrder } from "@/lib/services/orders/customer-view";

/**
 * The orders the caller may read, as a query condition: the ownership is checked by the query, on
 * columns that are not returned. Guest (no session, ?guestToken=…): the order of the guest user
 * holding that token. Admin: any order. Butcher: the orders of a shop whose ownerId is one of their
 * ids (clerkId or Prisma id; the shop owner in test mode). Customer: their own orders.
 */
async function readableOrder(
  orderId: string,
  clerkId: string | null,
  guestToken: string
): Promise<Prisma.OrderWhereInput | null> {
  if (!clerkId) return { id: orderId, user: { guestToken } };
  const dbUser = await getOrCreateUser(clerkId);
  if (!dbUser) return null;
  if (dbUser.role === "ADMIN") return { id: orderId };
  if (dbUser.role === "BOUCHER") {
    const testOwner = await getBoucherOwnerUserId();
    const ownerIds = [clerkId, dbUser.id, testOwner].filter(
      (ownerId): ownerId is string => !!ownerId
    );
    return { id: orderId, shop: { ownerId: { in: ownerIds } } };
  }
  return { id: orderId, userId: dbUser.id };
}

// ── GET /api/orders/[id] ───────────────────────
// Order detail in the customer view (customer-view.ts), for the customer, a guest holding the
// magic-link token, the butcher of the shop or an admin. An order outside the caller's reach is 404.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guestToken = req.nextUrl.searchParams.get("guestToken") ?? "";
    const clerkId = await getServerUserId();
    if (!clerkId && !guestToken) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const where = await readableOrder(params.id, clerkId, guestToken);
    const readable = where && (await prisma.order.findFirst({ where, select: { id: true } }));
    if (!readable) return apiError("NOT_FOUND", "Commande introuvable");

    // A price adjustment whose deadline has passed is settled before the order is shown.
    await settleDueAdjustment(readable.id, new Date());
    const order = await findCustomerOrder(where);
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/[id] GET");
  }
}
