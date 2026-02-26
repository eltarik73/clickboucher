// GET /api/webmaster/notifications — Notification stats for webmaster
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalNotifs,
      last30d,
      last7d,
      byChannel,
      byType,
      deliveredCount,
      readCount,
      recentNotifs,
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.notification.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

      // By channel
      prisma.notification.groupBy({
        by: ["channel"],
        _count: true,
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // Top 10 types (30d)
      prisma.notification.groupBy({
        by: ["type"],
        _count: true,
        where: { createdAt: { gte: thirtyDaysAgo } },
        orderBy: { _count: { type: "desc" } },
        take: 10,
      }),

      // Delivered
      prisma.notification.count({
        where: { delivered: true, createdAt: { gte: thirtyDaysAgo } },
      }),

      // Read
      prisma.notification.count({
        where: { read: true, createdAt: { gte: thirtyDaysAgo } },
      }),

      // Recent 20 notifications
      prisma.notification.findMany({
        select: {
          id: true,
          type: true,
          message: true,
          channel: true,
          read: true,
          delivered: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Daily volume (last 7 days)
    const notifs7d = await prisma.notification.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });
    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dailyMap.set(d.toISOString().split("T")[0], 0);
    }
    for (const n of notifs7d) {
      const key = new Date(n.createdAt).toISOString().split("T")[0];
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
    }
    const dailyVolume = Array.from(dailyMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return apiSuccess({
      total: totalNotifs,
      last30d,
      last7d,
      deliveryRate: last30d > 0 ? Math.round((deliveredCount / last30d) * 100) : 0,
      readRate: last30d > 0 ? Math.round((readCount / last30d) * 100) : 0,
      byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      dailyVolume,
      recent: recentNotifs,
    });
  } catch (error) {
    return handleApiError(error, "webmaster/notifications");
  }
}
