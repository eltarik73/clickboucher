// src/app/api/boucher/anti-gaspi/route.ts — Anti-gaspi management for boucher
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { enableAntiGaspiSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import {
  antiGaspiExpired,
  antiGaspiInForceWhere,
  publicPriceCents,
} from "@/lib/pricing/anti-gaspi";

export const dynamic = "force-dynamic";

/** GET — List the shop's products whose anti-gaspi is in force (an expired one is over) */
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const products = await prisma.product.findMany({
      where: { shopId, ...antiGaspiInForceWhere(new Date()) },
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
    const now = new Date();
    if (product.isAntiGaspi && !antiGaspiExpired(product, now)) {
      return apiError("VALIDATION_ERROR", "Ce produit est deja en anti-gaspi");
    }

    // The discount applies to the price customers pay now: after an expired anti-gaspi, its
    // original price, never the old discounted one still stored in priceCents.
    const basePriceCents = publicPriceCents(product, now);
    const newPriceCents = Math.round(basePriceCents * (1 - data.discountPercent / 100));

    // Default end: end of today
    const endAt = data.endAt
      ? new Date(data.endAt)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const updated = await prisma.product.update({
      where: { id: data.productId },
      data: {
        isAntiGaspi: true,
        antiGaspiOrigPriceCents: basePriceCents,
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
