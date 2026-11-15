export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { settleAntiGaspi } from "@/lib/pricing/anti-gaspi";

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
    const limit = Math.min(200, Number(url.searchParams.get("limit")) || 100);
    const cursor = url.searchParams.get("cursor") || undefined;

    const where: Record<string, unknown> = { shopId };
    if (categoryId) where.categories = { some: { id: categoryId } };
    if (inStock === "true") where.inStock = true;
    if (inStock === "false") where.inStock = false;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const items = await prisma.product.findMany({
      where,
      include: { categories: true, images: true, labels: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    // As customers see them: an expired anti-gaspi at its original price, mode off.
    const now = new Date();
    const products = (hasMore ? items.slice(0, limit) : items).map((p) => settleAntiGaspi(p, now));

    // Backward-compatible: still returns array directly (frontend expects products[])
    return apiSuccess(products);
  } catch (error) {
    return handleApiError(error, "boucher/products GET");
  }
}
