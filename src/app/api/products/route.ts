import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { productListQuerySchema, createProductSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// Include block for all product queries
const PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { order: "asc" as const } },
  labels: true,
};

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
    if (query.featured === "true") {
      where.featured = true;
    }
    if (query.tag) {
      where.tags = { has: query.tag };
    }
    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }

    const products = await prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: [{ displayOrder: "asc" }, { category: { order: "asc" } }, { name: "asc" }],
    });

    // Check if user is CLIENT_PRO to include proPriceCents
    const { sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;
    const isPro = role === "client_pro";

    const data = products.map((p) => {
      if (isPro) return p;
      const { proPriceCents, ...rest } = p;
      return rest;
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
        minWeightG: data.minWeightG,
        weightStepG: data.weightStepG,
        maxWeightG: data.maxWeightG,
        displayOrder: data.displayOrder ?? 0,
        featured: data.featured ?? false,
        popular: data.popular ?? false,
        categoryId: data.categoryId,
        shopId: data.shopId,
        tags: data.tags ?? [],
        origin: data.origin,
        halalOrg: data.halalOrg,
        race: data.race,
        freshness: data.freshness,
        customerNote: data.customerNote,
        promoPct: data.promoPct,
        promoEnd: data.promoEnd ? new Date(data.promoEnd) : null,
        promoType: data.promoType,
        ...(data.images?.length && {
          images: {
            create: data.images.map((img) => ({
              url: img.url,
              alt: img.alt,
              order: img.order,
              isPrimary: img.isPrimary,
            })),
          },
        }),
        ...(data.labels?.length && {
          labels: {
            create: data.labels.map((l) => ({
              name: l.name,
              color: l.color,
            })),
          },
        }),
      },
      include: PRODUCT_INCLUDE,
    });

    return apiSuccess(product, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
