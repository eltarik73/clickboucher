import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck.error) return adminCheck.error;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

    // ── Parallel queries ─────────────────────────
    const [
      allOrders30d,
      ordersByStatus,
      topProductsRaw,
      topShopsRaw,
      usersRaw,
      avgOrderValue,
      totalOrders,
      deniedCount,
    ] = await Promise.all([
      // Orders last 30 days (for daily charts)
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: {
          totalCents: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),

      // Orders by status (all time)
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
      }),

      // Top 10 products by order count
      prisma.orderItem.groupBy({
        by: ["name"],
        _count: true,
        _sum: { totalCents: true },
        orderBy: { _count: { name: "desc" } },
        take: 10,
      }),

      // Top 5 shops
      prisma.shop.findMany({
        select: {
          name: true,
          rating: true,
          orders: {
            where: { status: { in: ["COMPLETED", "PICKED_UP"] } },
            select: { totalCents: true },
          },
        },
        orderBy: { orders: { _count: "desc" } },
        take: 5,
      }),

      // Users created in last 8 weeks
      prisma.user.findMany({
        where: { createdAt: { gte: eightWeeksAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),

      // Avg order value (completed)
      prisma.order.aggregate({
        where: { status: { in: ["COMPLETED", "PICKED_UP"] } },
        _avg: { totalCents: true },
      }),

      // Total orders
      prisma.order.count(),

      // Denied count
      prisma.order.count({ where: { status: "DENIED" } }),
    ]);

    // ── Revenue & orders by day ──────────────────
    const dayMap = new Map<string, { revenue: number; count: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dayMap.set(key, { revenue: 0, count: 0 });
    }

    for (const o of allOrders30d) {
      const key = new Date(o.createdAt).toISOString().split("T")[0];
      const entry = dayMap.get(key);
      if (entry) {
        entry.count++;
        if (["COMPLETED", "PICKED_UP"].includes(o.status)) {
          entry.revenue += o.totalCents;
        }
      }
    }

    const revenueByDay = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      revenue: v.revenue,
    }));

    const ordersByDay = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      count: v.count,
    }));

    // ── Avg prep time (PENDING → last update for processed orders) ──
    const processedOrders = allOrders30d.filter((o) =>
      ["ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED"].includes(o.status)
    );
    let avgPrepTime = 0;
    if (processedOrders.length > 0) {
      const totalMin = processedOrders.reduce((sum, o) => {
        const diff = new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime();
        return sum + diff / 60000;
      }, 0);
      avgPrepTime = Math.round(totalMin / processedOrders.length);
    }

    // ── User growth by week ──────────────────────
    const weekMap = new Map<string, number>();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const key = weekStart.toISOString().split("T")[0];
      weekMap.set(key, 0);
    }
    const weekKeys = Array.from(weekMap.keys());
    for (const u of usersRaw) {
      const uDate = new Date(u.createdAt).getTime();
      for (let i = weekKeys.length - 1; i >= 0; i--) {
        if (uDate >= new Date(weekKeys[i]).getTime()) {
          weekMap.set(weekKeys[i], (weekMap.get(weekKeys[i]) || 0) + 1);
          break;
        }
      }
    }
    const userGrowth = weekKeys.map((week) => ({
      week,
      count: weekMap.get(week) || 0,
    }));

    // ── Top products ─────────────────────────────
    const topProducts = topProductsRaw.map((p) => ({
      name: p.name,
      count: p._count,
      revenue: p._sum.totalCents || 0,
    }));

    // ── Top shops ────────────────────────────────
    const topShops = topShopsRaw.map((s) => ({
      name: s.name,
      orders: s.orders.length,
      revenue: s.orders.reduce((sum, o) => sum + o.totalCents, 0),
      rating: s.rating,
    }));

    // ── Monthly revenue ──────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = allOrders30d
      .filter(
        (o) =>
          new Date(o.createdAt) >= monthStart &&
          ["COMPLETED", "PICKED_UP"].includes(o.status)
      )
      .reduce((s, o) => s + o.totalCents, 0);

    return apiSuccess({
      revenueByDay,
      ordersByDay,
      ordersByStatus: ordersByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      topProducts,
      topShops,
      userGrowth,
      avgOrderValue: avgOrderValue._avg.totalCents || 0,
      avgPrepTime,
      monthlyRevenue,
      denyRate: totalOrders > 0 ? deniedCount / totalOrders : 0,
    });
  } catch (error) {
    return handleApiError(error, "admin/analytics");
  }
}
