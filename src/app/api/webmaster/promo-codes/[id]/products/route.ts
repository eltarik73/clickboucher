// GET/POST/DELETE /api/webmaster/promo-codes/[id]/products — Manage eligible products for BOGO/BUNDLE offers
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// ── GET — List eligible products for an offer ──
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const products = await prisma.offerProduct.findMany({
      where: { promoCodeId: id },
      include: {
        product: { select: { id: true, name: true, imageUrl: true, priceCents: true, unit: true, inStock: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ products });
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/products/GET");
  }
}

const addSchema = z.object({
  productIds: z.array(z.string()).min(1),
  shopId: z.string(),
});

// ── POST — Add eligible products ──
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const body = await req.json();
    const { productIds, shopId } = addSchema.parse(body);

    // Verify promo code exists
    const pc = await prisma.promoCode.findUnique({ where: { id } });
    if (!pc) return apiError("NOT_FOUND", "Code promo introuvable");

    // Verify products belong to the shop
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return apiError("VALIDATION_ERROR", "Certains produits n'appartiennent pas à cette boutique");
    }

    // Upsert (skip existing)
    const created = await prisma.offerProduct.createMany({
      data: productIds.map((productId) => ({
        promoCodeId: id,
        productId,
        shopId,
      })),
      skipDuplicates: true,
    });

    return apiSuccess({ added: created.count });
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/products/POST");
  }
}

const removeSchema = z.object({
  productIds: z.array(z.string()).min(1),
});

// ── DELETE — Remove eligible products ──
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const body = await req.json();
    const { productIds } = removeSchema.parse(body);

    await prisma.offerProduct.deleteMany({
      where: { promoCodeId: id, productId: { in: productIds } },
    });

    return apiSuccess({ removed: productIds.length });
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/products/DELETE");
  }
}
