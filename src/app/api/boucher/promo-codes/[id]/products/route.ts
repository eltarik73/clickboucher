// GET/POST /api/boucher/promo-codes/[id]/products — Boucher manages eligible products for an accepted offer
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// ── GET — List eligible products for this offer in boucher's shop ──
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const { id } = await ctx.params;

    const products = await prisma.offerProduct.findMany({
      where: { promoCodeId: id, shopId },
      include: {
        product: { select: { id: true, name: true, imageUrl: true, priceCents: true, unit: true, inStock: true } },
      },
    });

    return apiSuccess({ products });
  } catch (error) {
    return handleApiError(error, "boucher/promo-codes/products/GET");
  }
}

const addSchema = z.object({
  productIds: z.array(z.string()).min(1),
});

// ── POST — Boucher selects eligible products for an offer ──
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const { id } = await ctx.params;
    const body = await req.json();
    const { productIds } = addSchema.parse(body);

    // Verify promo code exists and is related to this shop
    const pc = await prisma.promoCode.findUnique({ where: { id } });
    if (!pc) return apiError("NOT_FOUND", "Code promo introuvable");

    // Verify products belong to boucher's shop
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return apiError("VALIDATION_ERROR", "Certains produits ne sont pas dans votre boutique");
    }

    // Clear existing and replace
    await prisma.offerProduct.deleteMany({ where: { promoCodeId: id, shopId } });

    const created = await prisma.offerProduct.createMany({
      data: productIds.map((productId) => ({
        promoCodeId: id,
        productId,
        shopId,
      })),
      skipDuplicates: true,
    });

    return apiSuccess({ selected: created.count });
  } catch (error) {
    return handleApiError(error, "boucher/promo-codes/products/POST");
  }
}
