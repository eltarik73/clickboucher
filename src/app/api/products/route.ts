import { NextRequest } from "next/server";
// Audit sécurité 2026-05-09 : retiré currentUser Clerk au profit de DB lookup.
import type { Prisma } from "@prisma/client";
import { resolveUserRole } from "@/lib/auth/server-auth";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { productListQuerySchema, createProductSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";
import { priceAudienceOf } from "@/lib/product-price-audience";
import { proProductSelect, publicProductSelect } from "@/lib/public-projections";

export const dynamic = "force-dynamic";

// Catalogue page of the shop owner (and admins): the public fields plus the management ones.
// Anonymous and ordinary callers get publicProductSelect, CLIENT_PRO gets proProductSelect.
const MANAGER_PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  priceCents: true,
  proPriceCents: true,
  boutiquePriceCents: true,
  unit: true,
  inStock: true,
  stockQty: true,
  tags: true,
  origin: true,
  halalOrg: true,
  race: true,
  freshness: true,
  originRegion: true,
  raceDescription: true,
  elevageMode: true,
  elevageDetail: true,
  halalMethod: true,
  freshDate: true,
  freshDetail: true,
  popular: true,
  promoPct: true,
  promoEnd: true,
  promoType: true,
  customerNote: true,
  shopId: true,
  displayOrder: true,
  minWeightG: true,
  weightStepG: true,
  isActive: true,
  unitLabel: true,
  sliceOptions: true,
  variants: true,
  weightPerPiece: true,
  pieceLabel: true,
  weightMargin: true,
  maxWeightG: true,
  cutOptions: true,
  promoFixedCents: true,
  packContent: true,
  packWeight: true,
  packOldPriceCents: true,
  snoozeType: true,
  snoozedAt: true,
  snoozeEndsAt: true,
  snoozeReason: true,
  categories: { select: { id: true, name: true, emoji: true } },
  images: {
    orderBy: { order: "asc" as const },
    select: { id: true, url: true, alt: true, order: true, isPrimary: true },
  },
  labels: { select: { id: true, name: true, color: true } },
} as const satisfies Prisma.ProductSelect;

function findProducts<S extends Prisma.ProductSelect>(where: Prisma.ProductWhereInput, select: S) {
  return prisma.product.findMany({
    where,
    select,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    take: 200,
  });
}

// Full include block for create/update
const PRODUCT_INCLUDE = {
  categories: true,
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
      where.categories = { some: { id: query.categoryId } };
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

    // Resolved BEFORE the cache: the response depends on the caller, the cache must not.
    const audience = await priceAudienceOf({ shopId: query.shopId });

    // ── Cache lookup for unfiltered product lists ──
    // Only the public projection is cached (key shared with the invalidation in
    // /api/products/[id]/active): pro and manager responses never read nor write it.
    const hasFilters =
      query.categoryId || query.inStock || query.featured || query.tag || query.search;
    const productsCacheKey =
      audience === "PUBLIC" && !hasFilters ? `products:shop:${query.shopId}` : null;

    if (productsCacheKey) {
      try {
        const cached = await redis.get<unknown>(productsCacheKey);
        if (cached) return apiSuccess(cached);
      } catch {
        // Redis down — continue without cache
      }
    }

    const data =
      audience === "MANAGER"
        ? await findProducts(where, MANAGER_PRODUCT_SELECT)
        : audience === "PRO"
          ? await findProducts(where, proProductSelect)
          : await findProducts(where, publicProductSelect);

    // ── Cache store (TTL 60s) ──
    if (productsCacheKey) {
      try {
        await redis.set(productsCacheKey, data, { ex: 60 });
      } catch {
        // Redis down — continue without cache
      }
    }

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/products ─────────────────────────
// Boucher (owner) or Admin — create a product
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId: authShopId } = authResult;

    const body = await req.json();
    const data = createProductSchema.parse(body);

    // Audit sécurité 2026-05-09 : resolveUserRole = DB lookup
    const role = await resolveUserRole();
    if (!isAdmin(role)) {
      if (data.shopId !== authShopId) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
    }

    // Verify all categories belong to the shop
    const cats = await prisma.category.findMany({
      where: { id: { in: data.categoryIds }, shopId: data.shopId },
      select: { id: true },
    });
    if (cats.length !== data.categoryIds.length) {
      return apiError(
        "VALIDATION_ERROR",
        "Une ou plusieurs catégories n'appartiennent pas à cette boucherie"
      );
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        priceCents: data.priceCents,
        boutiquePriceCents: data.boutiquePriceCents ?? null,
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
        categories: { connect: data.categoryIds.map((id) => ({ id })) },
        shopId: data.shopId,
        tags: data.tags ?? [],
        origin: data.origin,
        halalOrg: data.halalOrg,
        race: data.race,
        freshness: data.freshness,
        customerNote: data.customerNote,
        originRegion: data.originRegion,
        raceDescription: data.raceDescription,
        elevageMode: data.elevageMode,
        elevageDetail: data.elevageDetail,
        halalMethod: data.halalMethod,
        freshDate: data.freshDate ? new Date(data.freshDate) : null,
        freshDetail: data.freshDetail,
        promoPct: data.promoPct,
        promoEnd: data.promoEnd ? new Date(data.promoEnd) : null,
        promoType: data.promoType,
        isActive: data.isActive ?? true,
        unitLabel: data.unitLabel,
        sliceOptions: data.sliceOptions ?? undefined,
        variants: data.variants || [],
        weightPerPiece: data.weightPerPiece,
        pieceLabel: data.pieceLabel,
        weightMargin: data.weightMargin,
        cutOptions: data.cutOptions ?? undefined,
        promoFixedCents: data.promoFixedCents,
        packContent: data.packContent,
        packWeight: data.packWeight,
        packOldPriceCents: data.packOldPriceCents,
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
