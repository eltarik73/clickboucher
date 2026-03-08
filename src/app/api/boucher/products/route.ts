export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

// ── GET /api/boucher/products ────────────────
// Boucher (owner) — list products for their shop
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const url = new URL(req.url);
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const inStock = url.searchParams.get("inStock");
    const search = url.searchParams.get("search") || undefined;

    const where: Record<string, unknown> = { shopId };
    if (categoryId) where.categories = { some: { id: categoryId } };
    if (inStock === "true") where.inStock = true;
    if (inStock === "false") where.inStock = false;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const products = await prisma.product.findMany({
      where,
      include: { categories: true, images: true, labels: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      take: 500,
    });

    return apiSuccess(products);
  } catch (error) {
    return handleApiError(error, "boucher/products GET");
  }
}
