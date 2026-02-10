import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    // Auth check
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as Record<string, string>)?.role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalRevenue,
      revenueThisMonth,
      totalOrders,
      todayOrders,
      pendingOrders,
      activeShops,
      totalUsers,
      totalProducts,
      pendingProRequests,
      avgRating,
      topShopsRaw,
      staleOrders,
      pausedShops,
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
        where: { isOpen: true, paused: false },
      }),

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
    ]);

    const topShops = topShopsRaw.map((s) => ({
      id: s.id,
      name: s.name,
      rating: s.rating,
      orderCount: s.orders.length,
      revenue: s.orders.reduce((sum, o) => sum + o.totalCents, 0),
    }));

    return NextResponse.json({
      totalRevenue: totalRevenue._sum.totalCents || 0,
      revenueThisMonth: revenueThisMonth._sum.totalCents || 0,
      totalOrders,
      todayOrders,
      pendingOrders,
      activeShops,
      totalUsers,
      totalProducts,
      pendingProRequests,
      avgRating: avgRating._avg.rating || 0,
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
