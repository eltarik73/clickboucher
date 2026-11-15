import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { invalidateCachedProducts } from "@/lib/cache/products-cache";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const toggleActiveSchema = z.object({
  isActive: z.boolean(),
});

export const dynamic = "force-dynamic";

// ── PATCH /api/products/[id]/active ─────────────
// Boucher (owner) only — quick isActive toggle
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { shopId: true },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    if (product.shopId !== shopId) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const body = await req.json();
    const { isActive } = toggleActiveSchema.parse(body);

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    });

    await invalidateCachedProducts(product.shopId);

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
