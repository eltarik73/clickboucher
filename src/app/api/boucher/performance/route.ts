// API: GET /api/boucher/performance
import prisma from "@/lib/prisma";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { refreshShopMetrics } from "@/lib/services/performance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthenticatedBoucher();
    if ("error" in auth) return auth.error;

    const shop = await prisma.shop.findUnique({
      where: { id: auth.shopId },
      select: {
        cachedAcceptanceRate: true,
        cachedAvgPrepMinutes: true,
        cachedCancelRate: true,
        cachedResponseMinutes: true,
        cachedLateRate: true,
        cachedAvgRating: true,
        performanceScore: true,
        metricsUpdatedAt: true,
      },
    });

    // If metrics are stale (>24h) or never computed, refresh
    const isStale =
      !shop?.metricsUpdatedAt ||
      Date.now() - shop.metricsUpdatedAt.getTime() > 24 * 60 * 60 * 1000;

    if (isStale) {
      await refreshShopMetrics(auth.shopId);
    }

    const [freshShop, alerts] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: auth.shopId },
        select: {
          cachedAcceptanceRate: true,
          cachedAvgPrepMinutes: true,
          cachedCancelRate: true,
          cachedResponseMinutes: true,
          cachedLateRate: true,
          cachedAvgRating: true,
          performanceScore: true,
          metricsUpdatedAt: true,
        },
      }),
      prisma.shopAlert.findMany({
        where: { shopId: auth.shopId, resolved: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return apiSuccess({
      metrics: {
        acceptanceRate: freshShop?.cachedAcceptanceRate,
        avgPrepMinutes: freshShop?.cachedAvgPrepMinutes,
        cancelRate: freshShop?.cachedCancelRate,
        responseMinutes: freshShop?.cachedResponseMinutes,
        lateRate: freshShop?.cachedLateRate,
        avgRating: freshShop?.cachedAvgRating,
        performanceScore: freshShop?.performanceScore,
      },
      alerts,
      updatedAt: freshShop?.metricsUpdatedAt,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/boucher/performance");
  }
}
