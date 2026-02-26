// GET /api/webmaster/promos — Global promo overview + calendar events for webmaster
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const sp = req.nextUrl.searchParams;
    const { page, perPage } = parsePagination(sp, { page: 1, perPage: 30 });
    const shopId = sp.get("shopId") || "";
    const promoType = sp.get("promoType") || ""; // PERCENTAGE | FLASH | BUY_X_GET_Y
    const status = sp.get("status") || "active"; // active | expired | all
    const sortBy = sp.get("sort") || "discount_desc"; // discount_desc | discount_asc | newest | ending_soon

    const now = new Date();

    // ── Build where clause ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      promoPct: { gt: 0 },
    };
    if (shopId) where.shopId = shopId;
    if (promoType) where.promoType = promoType;
    if (status === "active") {
      where.OR = [{ promoEnd: null }, { promoEnd: { gt: now } }];
    } else if (status === "expired") {
      where.promoEnd = { lte: now };
    }

    // ── Sort ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any;
    switch (sortBy) {
      case "discount_asc":
        orderBy = { promoPct: "asc" };
        break;
      case "newest":
        orderBy = { updatedAt: "desc" };
        break;
      case "ending_soon":
        orderBy = { promoEnd: "asc" };
        break;
      default:
        orderBy = { promoPct: "desc" };
    }

    // ── Fetch promos + total ──
    const [promos, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.product.count({ where }),
    ]);

    // ── Global stats ──
    const [
      totalActive,
      totalFlash,
      totalPercentage,
      totalBuyXGetY,
      avgDiscount,
      expiringSoon,
      perShop,
    ] = await Promise.all([
      // Active promos
      prisma.product.count({
        where: {
          promoPct: { gt: 0 },
          OR: [{ promoEnd: null }, { promoEnd: { gt: now } }],
        },
      }),
      // Flash
      prisma.product.count({
        where: {
          promoPct: { gt: 0 },
          promoType: "FLASH",
          OR: [{ promoEnd: null }, { promoEnd: { gt: now } }],
        },
      }),
      // Percentage
      prisma.product.count({
        where: {
          promoPct: { gt: 0 },
          promoType: "PERCENTAGE",
          OR: [{ promoEnd: null }, { promoEnd: { gt: now } }],
        },
      }),
      // BuyXGetY
      prisma.product.count({
        where: {
          promoPct: { gt: 0 },
          promoType: "BUY_X_GET_Y",
          OR: [{ promoEnd: null }, { promoEnd: { gt: now } }],
        },
      }),
      // Average discount
      prisma.product.aggregate({
        where: {
          promoPct: { gt: 0 },
          OR: [{ promoEnd: null }, { promoEnd: { gt: now } }],
        },
        _avg: { promoPct: true },
      }),
      // Expiring in next 48h
      prisma.product.count({
        where: {
          promoPct: { gt: 0 },
          promoEnd: {
            gt: now,
            lte: new Date(now.getTime() + 48 * 3600_000),
          },
        },
      }),
      // Per-shop active promo counts
      prisma.product.groupBy({
        by: ["shopId"],
        where: {
          promoPct: { gt: 0 },
          OR: [{ promoEnd: null }, { promoEnd: { gt: now } }],
        },
        _count: true,
        _avg: { promoPct: true },
        orderBy: { _count: { promoPct: "desc" } },
      }),
    ]);

    // Resolve shop names for perShop
    const shopIds = perShop.map((s) => s.shopId);
    const shops = await prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true },
    });
    const shopMap = Object.fromEntries(shops.map((s) => [s.id, s.name]));

    const perShopData = perShop.map((s) => ({
      shopId: s.shopId,
      shopName: shopMap[s.shopId] || "?",
      activePromos: s._count,
      avgDiscount: Math.round(s._avg.promoPct || 0),
    }));

    // ── Calendar events (upcoming 60 days) ──
    const upcomingEvents = await prisma.calendarEvent.findMany({
      where: {
        active: true,
        date: {
          gte: new Date(now.getTime() - 7 * 86400_000), // include recent past
          lte: new Date(now.getTime() + 60 * 86400_000),
        },
      },
      orderBy: { date: "asc" },
    });

    return apiSuccess({
      promos: promos.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        promoPct: p.promoPct,
        promoType: p.promoType,
        promoEnd: p.promoEnd,
        inStock: p.inStock,
        imageUrl: p.imageUrl,
        shop: p.shop,
        category: p.category,
      })),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      stats: {
        totalActive,
        totalFlash,
        totalPercentage,
        totalBuyXGetY,
        avgDiscount: Math.round(avgDiscount._avg.promoPct || 0),
        expiringSoon,
      },
      perShop: perShopData,
      calendarEvents: upcomingEvents.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        date: e.date,
        type: e.type,
        emoji: e.emoji,
        alertDaysBefore: e.alertDaysBefore,
        suggestedProducts: e.suggestedProducts,
      })),
    });
  } catch (error) {
    return handleApiError(error, "webmaster/promos");
  }
}
