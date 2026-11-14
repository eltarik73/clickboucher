// src/app/api/orders/[id]/alternatives/route.ts — replacement products for the out-of-stock lines of
// the customer's order: same category and same unit as the line they would replace. The customer is
// the holder of the order's credential cookie or the signed-in customer who placed it
// (authorizeOrderAccess, src/lib/auth/order-access.ts). An order outside the caller's reach is 404.
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { authorizeOrderAccess, orderAccessRefusal } from "@/lib/auth/order-access";
import { findAlternatives } from "@/lib/services/orders/commands/alternatives";

export const dynamic = "force-dynamic";

// ── GET /api/orders/[id]/alternatives?products=id1,id2 ──
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await authorizeOrderAccess(params.id, req.cookies);
    if (!access.ok) return orderAccessRefusal(access.status);

    const order = await prisma.order.findFirst({
      where: { id: access.orderId, userId: access.customerId },
      select: { shopId: true, items: { select: { productId: true, unit: true, available: true } } },
    });
    if (order === null) return apiError("NOT_FOUND", "Commande introuvable");

    const requested = new Set(
      (req.nextUrl.searchParams.get("products") ?? "").split(",").filter(Boolean)
    );
    const lines = order.items.filter((item) => !item.available && requested.has(item.productId));
    return apiSuccess(await findAlternatives(order.shopId, lines));
  } catch (error) {
    return handleApiError(error, "orders/alternatives");
  }
}
