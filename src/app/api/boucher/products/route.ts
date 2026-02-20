export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── GET /api/boucher/products ────────────────
// Boucher (owner) — list products for their shop
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Aucune boutique trouvée");

    const url = new URL(req.url);
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const inStock = url.searchParams.get("inStock");
    const search = url.searchParams.get("search") || undefined;

    const where: Record<string, unknown> = { shopId: shop.id };
    if (categoryId) where.categoryId = categoryId;
    if (inStock === "true") where.inStock = true;
    if (inStock === "false") where.inStock = false;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const products = await prisma.product.findMany({
      where,
      include: { category: true, images: true, labels: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      take: 500,
    });

    return apiSuccess(products);
  } catch (error) {
    return handleApiError(error, "boucher/products GET");
  }
}
