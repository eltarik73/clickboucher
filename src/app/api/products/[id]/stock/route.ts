import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { toggleStockSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── PATCH /api/products/[id]/stock ─────────────
// Boucher (owner) only — quick stock toggle
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { shop: { select: { ownerId: true } } },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    if (product.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const body = await req.json();
    const data = toggleStockSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.inStock !== undefined) updateData.inStock = data.inStock;
    if (data.stockQty !== undefined) {
      updateData.stockQty = data.stockQty;
      // Auto-set inStock based on stockQty
      if (data.inStock === undefined) {
        updateData.inStock = data.stockQty > 0;
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, inStock: true, stockQty: true },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
