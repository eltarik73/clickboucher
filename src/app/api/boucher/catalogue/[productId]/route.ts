import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const body = await req.json();

    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      include: { shop: { select: { ownerId: true } } },
    });
    if (!product) return apiError("NOT_FOUND", "Produit introuvable");
    if (product.shop.ownerId !== userId) return apiError("FORBIDDEN", "Accès refusé");

    const updateData: Record<string, unknown> = {};
    if (body.inStock !== undefined) updateData.inStock = body.inStock;
    if (body.stockQty !== undefined) updateData.stockQty = body.stockQty;
    if (body.priceCents !== undefined) updateData.priceCents = body.priceCents;
    if (body.proPriceCents !== undefined) updateData.proPriceCents = body.proPriceCents;

    const updated = await prisma.product.update({
      where: { id: params.productId },
      data: updateData,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
