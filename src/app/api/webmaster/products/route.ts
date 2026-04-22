// GET /api/webmaster/products — Global product catalogue for webmaster
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
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
    const search = sp.get("search")?.trim() || "";
    const shopId = sp.get("shopId") || "";
    const stockFilter = sp.get("stock") || ""; // "in" | "out" | "snoozed" | ""
    const activeFilter = sp.get("active") || ""; // "yes" | "no" | ""
    const promoFilter = sp.get("promo") || ""; // "yes" | ""
    const sortBy = sp.get("sort") || "newest"; // newest | name | price_asc | price_desc | shop

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { shop: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (shopId) where.shopId = shopId;

    if (stockFilter === "in") {
      where.inStock = true;
      where.snoozeType = "NONE";
    } else if (stockFilter === "out") {
      where.inStock = false;
    } else if (stockFilter === "snoozed") {
      where.snoozeType = { not: "NONE" };
      where.inStock = true;
    }

    if (activeFilter === "yes") where.isActive = true;
    if (activeFilter === "no") where.isActive = false;

    if (promoFilter === "yes") {
      where.promoPct = { not: null, gt: 0 };
    }

    // Sort
    let orderBy: Prisma.ProductOrderByWithRelationInput;
    switch (sortBy) {
      case "name":
        orderBy = { name: "asc" };
        break;
      case "price_asc":
        orderBy = { priceCents: "asc" };
        break;
      case "price_desc":
        orderBy = { priceCents: "desc" };
        break;
      case "shop":
        orderBy = { shop: { name: "asc" } };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          priceCents: true,
          proPriceCents: true,
          unit: true,
          inStock: true,
          isActive: true,
          featured: true,
          popular: true,
          promoPct: true,
          promoEnd: true,
          promoType: true,
          origin: true,
          freshness: true,
          snoozeType: true,
          snoozeEndsAt: true,
          tags: true,
          createdAt: true,
          shopId: true,
          shop: { select: { id: true, name: true, slug: true } },
          categories: { select: { id: true, name: true, emoji: true } },
          labels: { select: { id: true, name: true, color: true } },
          _count: { select: { orderItems: true } },
        },
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.product.count({ where }),
    ]);

    // Quick global stats
    const [totalAll, activeCount, outOfStock, promoCount, snoozedCount] =
      await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { isActive: true, inStock: true } }),
        prisma.product.count({ where: { inStock: false } }),
        prisma.product.count({ where: { promoPct: { not: null, gt: 0 } } }),
        prisma.product.count({ where: { snoozeType: { not: "NONE" } } }),
      ]);

    return apiSuccess({
      products,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      stats: {
        totalAll,
        active: activeCount,
        outOfStock,
        promo: promoCount,
        snoozed: snoozedCount,
      },
    });
  } catch (error) {
    return handleApiError(error, "webmaster/products");
  }
}
