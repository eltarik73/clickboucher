import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateProductStockSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const body = await req.json();
    const data = updateProductStockSchema.parse(body);

    const product = await prisma.product.findUnique({
      where: { id: params.productId },
    });
    if (!product) return apiError("NOT_FOUND", "Produit introuvable");

    const updateData: Record<string, unknown> = {};
    if (data.isInStock !== undefined) updateData.isInStock = data.isInStock;
    if (data.stockQty !== undefined) updateData.stockQty = data.stockQty;
    if (data.priceCents !== undefined) updateData.priceCents = data.priceCents;
    if (data.proPriceCents !== undefined) updateData.proPriceCents = data.proPriceCents;

    const updated = await prisma.product.update({
      where: { id: params.productId },
      data: updateData,
    });

    console.log(`[BOUCHER] Product ${updated.name} updated:`, updateData);

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
