import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { shopListQuerySchema, createShopSchema } from "@/lib/validators";
import { apiSuccess, apiPaginated, apiCached, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET /api/shops ─────────────────────────────
// Public — list shops with optional ?city, ?search, ?open filters
export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);

    // ?owned=true — return shops owned by the current user (for boucher)
    if (params.owned === "true") {
      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return apiError("UNAUTHORIZED", "Authentification requise");
      }
      const shops = await prisma.shop.findMany({
        where: { ownerId: clerkId },
        select: { id: true, slug: true, name: true, imageUrl: true, city: true },
      });
      return apiSuccess(shops);
    }

    const query = shopListQuerySchema.parse(params);

    const where: Record<string, unknown> = {};

    if (query.city) {
      where.city = { contains: query.city, mode: "insensitive" };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.open === "true") {
      where.status = { in: ["OPEN", "BUSY"] };
    } else if (query.open === "false") {
      where.status = { in: ["PAUSED", "AUTO_PAUSED", "CLOSED", "VACATION"] };
    }

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          address: true,
          city: true,
          imageUrl: true,
          status: true,
          rating: true,
          ratingCount: true,
          prepTimeMin: true,
          busyMode: true,
          busyExtraMin: true,
          description: true,
          _count: { select: { products: true } },
        },
        orderBy: [{ rating: "desc" }, { ratingCount: "desc" }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.shop.count({ where }),
    ]);

    // Add effectivePrepTime to each shop
    const data = shops.map((shop) => ({
      ...shop,
      effectivePrepTime: shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0),
    }));

    return apiPaginated(data, total, query.page, query.perPage);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/shops ────────────────────────────
// Admin only — create a new shop
export async function POST(req: NextRequest) {
  try {
    const { sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!sessionClaims) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }
    if (role !== "admin") {
      return apiError("FORBIDDEN", "Réservé aux administrateurs");
    }

    const body = await req.json();
    const data = createShopSchema.parse(body);

    const shop = await prisma.shop.create({
      data: {
        name: data.name,
        slug: data.slug,
        address: data.address,
        city: data.city,
        phone: data.phone,
        imageUrl: data.imageUrl,
        description: data.description,
        openingHours: data.openingHours ?? {},
        ownerId: data.ownerId,
        commissionPct: data.commissionPct ?? 0,
      },
    });

    return apiSuccess(shop, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
