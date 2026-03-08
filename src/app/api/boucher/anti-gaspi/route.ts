// src/app/api/boucher/anti-gaspi/route.ts — Anti-gaspi management for boucher
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { enableAntiGaspiSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** GET — List all anti-gaspi products for this shop */
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const products = await prisma.product.findMany({
      where: { shopId, isAntiGaspi: true },
      select: {
        id: true, name: true, imageUrl: true, priceCents: true, unit: true,
        antiGaspiStock: true, antiGaspiOrigPriceCents: true,
        antiGaspiEndAt: true, antiGaspiReason: true,
        inStock: true, categories: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess(products);
  } catch (error) {
    return handleApiError(error, "boucher/anti-gaspi/GET");
  }
}

/** POST — Enable anti-gaspi on a product */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const body = await req.json();
    const data = enableAntiGaspiSchema.parse(body);

    // Verify product belongs to shop
    const product = await prisma.product.findFirst({
      where: { id: data.productId, shopId },
    });
    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }
    if (product.isAntiGaspi) {
      return apiError("VALIDATION_ERROR", "Ce produit est deja en anti-gaspi");
    }

    // Calculate discounted price
    const newPriceCents = Math.round(product.priceCents * (1 - data.discountPercent / 100));

    // Default end: end of today
    const endAt = data.endAt
      ? new Date(data.endAt)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const updated = await prisma.product.update({
      where: { id: data.productId },
      data: {
        isAntiGaspi: true,
        antiGaspiOrigPriceCents: product.priceCents,
        priceCents: newPriceCents,
        antiGaspiStock: data.antiGaspiStock ?? null,
        antiGaspiReason: data.reason ?? null,
        antiGaspiEndAt: endAt,
        inStock: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/anti-gaspi/POST");
  }
}
