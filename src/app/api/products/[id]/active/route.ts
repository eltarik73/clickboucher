import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── PATCH /api/products/[id]/active ─────────────
// Boucher (owner) only — quick isActive toggle
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { userId } = authResult;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { shopId: true, shop: { select: { ownerId: true } } },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    if (product.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const body = await req.json();
    const isActive = typeof body.isActive === "boolean" ? body.isActive : !product;

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    });

    // Invalidate product cache
    try {
      await redis.del(`products:shop:${product.shopId}`);
    } catch {
      // Redis down — continue
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
