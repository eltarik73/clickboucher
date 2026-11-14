// src/app/api/orders/[id]/alternatives/route.ts — replacement products for the out-of-stock lines of
// the customer's order: same category and same unit as the line they would replace.
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { customerUserId } from "@/lib/services/orders/commands/outcome";
import { findAlternatives } from "@/lib/services/orders/commands/alternatives";

export const dynamic = "force-dynamic";

// ── GET /api/orders/[id]/alternatives?products=id1,id2 ──
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const userId = await customerUserId(clerkId);
    if (userId === null) return apiError("NOT_FOUND", "Commande introuvable");

    const order = await prisma.order.findFirst({
      where: { id: params.id, userId },
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
