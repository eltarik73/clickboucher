// GET /api/suggestions?shopId=xxx&productIds=id1,id2
// Returns cross-sell product suggestions based on cart contents
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const shopId = req.nextUrl.searchParams.get("shopId");
    const productIdsParam = req.nextUrl.searchParams.get("productIds");

    if (!shopId) return apiSuccess([]);

    const cartProductIds = productIdsParam?.split(",").filter(Boolean) || [];

    // 1. Check for explicit suggest rules
    let suggestedIds: string[] = [];
    if (cartProductIds.length > 0) {
      const rules = await prisma.suggestRule.findMany({
        where: {
          shopId,
          sourceProductId: { in: cartProductIds },
          targetProductId: { notIn: cartProductIds },
        },
        orderBy: { weight: "desc" },
        take: 8,
        select: { targetProductId: true },
      });
      suggestedIds = rules.map((r) => r.targetProductId);
    }

    // 2. If not enough suggestions, add popular/featured products from same shop
    if (suggestedIds.length < 4) {
      const popular = await prisma.product.findMany({
        where: {
          shopId,
          inStock: true,
          snoozeType: "NONE",
          id: { notIn: [...cartProductIds, ...suggestedIds] },
          OR: [{ popular: true }, { featured: true }],
        },
        take: 6 - suggestedIds.length,
        orderBy: { displayOrder: "asc" },
        select: { id: true },
      });
      suggestedIds.push(...popular.map((p) => p.id));
    }

    // 3. If still not enough, add random products from the shop
    if (suggestedIds.length < 3) {
      const others = await prisma.product.findMany({
        where: {
          shopId,
          inStock: true,
          snoozeType: "NONE",
          id: { notIn: [...cartProductIds, ...suggestedIds] },
        },
        take: 4 - suggestedIds.length,
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      suggestedIds.push(...others.map((p) => p.id));
    }

    if (suggestedIds.length === 0) return apiSuccess([]);

    // Fetch full product data
    const products = await prisma.product.findMany({
      where: { id: { in: suggestedIds } },
      include: {
        category: { select: { name: true } },
      },
    });

    return apiSuccess(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        proPriceCents: p.proPriceCents,
        unit: p.unit,
        category: p.category?.name,
        origin: p.origin,
        promoPct: p.promoPct,
        promoType: p.promoType,
      }))
    );
  } catch (error) {
    return handleApiError(error, "suggestions");
  }
}
