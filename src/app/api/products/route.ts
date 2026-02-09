import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { productListQuerySchema, createProductSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── GET /api/products ──────────────────────────
// Public — list products for a shop
export async function GET(req: NextRequest) {
  try {
    const raw = Object.fromEntries(req.nextUrl.searchParams);
    const query = productListQuerySchema.parse(raw);

    const where: Record<string, unknown> = { shopId: query.shopId };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.inStock === "true") {
      where.inStock = true;
    } else if (query.inStock === "false") {
      where.inStock = false;
    }
    if (query.tag) {
      where.tags = { has: query.tag };
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
    });

    // Check if user is CLIENT_PRO to include proPriceCents
    const { sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;
    const isPro = role === "client_pro";

    const data = products.map((p) => {
      const { proPriceCents, ...rest } = p;
      return isPro ? p : rest;
    });

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/products ─────────────────────────
// Boucher (owner) or Admin — create a product
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const data = createProductSchema.parse(body);

    // Verify ownership or admin
    if (role !== "admin") {
      const shop = await prisma.shop.findUnique({
        where: { id: data.shopId },
        select: { ownerId: true },
      });
      if (!shop) {
        return apiError("NOT_FOUND", "Boucherie introuvable");
      }
      if (shop.ownerId !== userId) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
    }

    // Verify category belongs to the shop
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { shopId: true },
    });
    if (!category || category.shopId !== data.shopId) {
      return apiError("VALIDATION_ERROR", "La catégorie n'appartient pas à cette boucherie");
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        priceCents: data.priceCents,
        proPriceCents: data.proPriceCents,
        unit: data.unit,
        inStock: data.inStock ?? true,
        stockQty: data.stockQty,
        categoryId: data.categoryId,
        shopId: data.shopId,
        tags: data.tags ?? [],
        promoPct: data.promoPct,
        promoEnd: data.promoEnd ? new Date(data.promoEnd) : null,
      },
      include: { category: true },
    });

    return apiSuccess(product, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
