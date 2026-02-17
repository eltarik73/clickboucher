import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last 7 days boundaries
    const days7: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days7.push(d);
    }

    const [
      totalRevenue,
      revenueThisMonth,
      totalOrders,
      todayOrders,
      pendingOrders,
      activeShops,
      totalShops,
      totalUsers,
      totalProducts,
      pendingProRequests,
      avgRating,
      topShopsRaw,
      staleOrders,
      pausedShops,
      totalCommission,
      shopsByPlanRaw,
      ordersLast7DaysRaw,
    ] = await Promise.all([
      // Total revenue (COMPLETED + PICKED_UP)
      prisma.order.aggregate({
        where: { status: { in: ["COMPLETED", "PICKED_UP"] } },
        _sum: { totalCents: true },
      }),

      // Revenue this month
      prisma.order.aggregate({
        where: {
          status: { in: ["COMPLETED", "PICKED_UP"] },
          createdAt: { gte: monthStart },
        },
        _sum: { totalCents: true },
      }),

      // Total orders
      prisma.order.count(),

      // Today orders
      prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),

      // Pending orders
      prisma.order.count({
        where: { status: "PENDING" },
      }),

      // Active shops
      prisma.shop.count({
        where: { status: { in: ["OPEN", "BUSY"] } },
      }),

      // Total shops
      prisma.shop.count(),

      // Total users
      prisma.user.count(),

      // Total products
      prisma.product.count(),

      // Pending pro requests
      prisma.user.count({
        where: { role: "CLIENT_PRO_PENDING" },
      }),

      // Avg rating
      prisma.shop.aggregate({
        where: { ratingCount: { gt: 0 } },
        _avg: { rating: true },
      }),

      // Top 5 shops by completed orders
      prisma.shop.findMany({
        select: {
          id: true,
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

      // Stale pending orders (> 30 min)
      prisma.order.findMany({
        where: {
          status: "PENDING",
          createdAt: { lte: new Date(now.getTime() - 30 * 60 * 1000) },
        },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          shop: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),

      // Paused shops
      prisma.shop.findMany({
        where: { paused: true },
        select: { id: true, name: true },
      }),

      // Total commission
      prisma.order.aggregate({
        where: { status: { in: ["COMPLETED", "PICKED_UP"] } },
        _sum: { commissionCents: true },
      }),

      // Shops by plan
      prisma.subscription.groupBy({
        by: ["plan"],
        _count: true,
      }),

      // Orders last 7 days (one query, group in JS)
      prisma.order.findMany({
        where: { createdAt: { gte: days7[0] } },
        select: { createdAt: true, totalCents: true, status: true },
      }),
    ]);

    const topShops = topShopsRaw.map((s) => ({
      id: s.id,
      name: s.name,
      rating: s.rating,
      orderCount: s.orders.length,
      revenue: s.orders.reduce((sum, o) => sum + o.totalCents, 0),
    }));

    // Build shopsByPlan map
    const shopsByPlan: Record<string, number> = { STARTER: 0, PRO: 0, PREMIUM: 0 };
    for (const row of shopsByPlanRaw) {
      shopsByPlan[row.plan] = row._count;
    }

    // Build ordersLast7Days chart data
    const ordersLast7Days = days7.map((dayStart, i) => {
      const dayEnd = i < 6 ? days7[i + 1] : new Date(dayStart.getTime() + 86400000);
      const dayOrders = ordersLast7DaysRaw.filter(
        (o) => o.createdAt >= dayStart && o.createdAt < dayEnd
      );
      return {
        date: dayStart.toISOString().slice(0, 10),
        orders: dayOrders.length,
        revenue: dayOrders
          .filter((o) => o.status === "COMPLETED" || o.status === "PICKED_UP")
          .reduce((s, o) => s + o.totalCents, 0),
      };
    });

    return apiSuccess({
      totalRevenue: totalRevenue._sum.totalCents || 0,
      revenueThisMonth: revenueThisMonth._sum.totalCents || 0,
      totalOrders,
      todayOrders,
      pendingOrders,
      activeShops,
      totalShops,
      totalUsers,
      totalProducts,
      pendingProRequests,
      avgRating: avgRating._avg.rating || 0,
      totalCommissionCents: totalCommission._sum.commissionCents || 0,
      shopsByPlan,
      ordersLast7Days,
      topShops,
      alerts: {
        staleOrders: staleOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          shopName: o.shop.name,
          minutesAgo: Math.round(
            (now.getTime() - new Date(o.createdAt).getTime()) / 60000
          ),
        })),
        pausedShops,
        pendingProRequests,
      },
    });
  } catch (error) {
    return handleApiError(error, "admin/stats");
  }
}
