// GET /api/webmaster/billing — Commission billing overview for webmaster
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const sp = req.nextUrl.searchParams;
    const period = sp.get("period") || "month"; // "week" | "month" | "year" | "all"

    const now = new Date();
    let periodStart: Date | undefined;

    if (period === "week") {
      periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      periodStart = new Date(now.getFullYear(), 0, 1);
    }
    // "all" → no date filter

    const completedStatuses = ["COMPLETED", "PICKED_UP"] as const;
    const dateFilter = periodStart ? { gte: periodStart } : undefined;

    // ── Global aggregates for period ──
    const periodAgg = await prisma.order.aggregate({
      where: {
        status: { in: [...completedStatuses] },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _sum: { totalCents: true, commissionCents: true },
      _count: true,
    });

    // ── All-time totals ──
    const allTimeAgg = await prisma.order.aggregate({
      where: { status: { in: [...completedStatuses] } },
      _sum: { totalCents: true, commissionCents: true },
      _count: true,
    });

    // ── Per-shop breakdown for period ──
    const shopBreakdown = await prisma.order.groupBy({
      by: ["shopId"],
      where: {
        status: { in: [...completedStatuses] },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _sum: { totalCents: true, commissionCents: true },
      _count: true,
      orderBy: { _sum: { commissionCents: "desc" } },
    });

    // Get shop info
    const shopIds = shopBreakdown.map((s) => s.shopId);
    const shops = await prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        commissionPct: true,
        commissionEnabled: true,
      },
    });
    const shopMap = new Map(shops.map((s) => [s.id, s]));

    const shopRows = shopBreakdown.map((row) => {
      const shop = shopMap.get(row.shopId);
      return {
        shopId: row.shopId,
        shopName: shop?.name || "Inconnu",
        shopSlug: shop?.slug || "",
        commissionPct: shop?.commissionPct || 0,
        commissionEnabled: shop?.commissionEnabled || false,
        orderCount: row._count,
        revenueCents: row._sum.totalCents || 0,
        commissionCents: row._sum.commissionCents || 0,
        netCents: (row._sum.totalCents || 0) - (row._sum.commissionCents || 0),
      };
    });

    // ── Monthly trend (last 6 months) ──
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyOrders = await prisma.order.findMany({
      where: {
        status: { in: [...completedStatuses] },
        createdAt: { gte: sixMonthsAgo },
      },
      take: 50000,
      select: {
        totalCents: true,
        commissionCents: true,
        createdAt: true,
      },
    });

    // Group by month
    const monthlyMap = new Map<string, { revenue: number; commission: number; orders: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, { revenue: 0, commission: 0, orders: 0 });
    }
    for (const o of monthlyOrders) {
      const d = o.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthlyMap.get(key);
      if (bucket) {
        bucket.revenue += o.totalCents;
        bucket.commission += o.commissionCents;
        bucket.orders += 1;
      }
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      ...data,
    }));

    // ── Recent commission orders ──
    const recentOrders = await prisma.order.findMany({
      where: {
        status: { in: [...completedStatuses] },
        commissionCents: { gt: 0 },
      },
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
        commissionCents: true,
        status: true,
        createdAt: true,
        shop: { select: { id: true, name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // ── Shops without commission enabled ──
    const shopsNoCommission = await prisma.shop.count({
      where: { commissionEnabled: false, visible: true },
    });

    return apiSuccess({
      period: {
        label: period,
        start: periodStart?.toISOString() || null,
        revenueCents: periodAgg._sum.totalCents || 0,
        commissionCents: periodAgg._sum.commissionCents || 0,
        netCents:
          (periodAgg._sum.totalCents || 0) -
          (periodAgg._sum.commissionCents || 0),
        orderCount: periodAgg._count,
      },
      allTime: {
        revenueCents: allTimeAgg._sum.totalCents || 0,
        commissionCents: allTimeAgg._sum.commissionCents || 0,
        orderCount: allTimeAgg._count,
      },
      shopRows,
      monthlyTrend,
      recentOrders,
      shopsNoCommission,
    });
  } catch (error) {
    return handleApiError(error, "webmaster/billing");
  }
}
