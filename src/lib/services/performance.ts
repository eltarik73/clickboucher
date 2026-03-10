// src/lib/services/performance.ts — Shop performance metrics
import prisma from "@/lib/prisma";

export interface ShopMetrics {
  acceptanceRate: number | null;
  avgPrepMinutes: number | null;
  cancelRate: number | null;
  responseMinutes: number | null;
  lateRate: number | null;
  avgRating: number | null;
}

const THRESHOLDS = {
  responseMinutes: { warning: 15, critical: 30 },
  cancelRate: { warning: 0.15, critical: 0.3 },
  acceptanceRate: { warning: 0.7, critical: 0.5 },
  lateRate: { warning: 0.2, critical: 0.4 },
  avgRating: { warning: 3.5, critical: 2.5 },
};

/**
 * Calculate all performance metrics for a shop from the last 30 days.
 */
export async function calculateShopMetrics(shopId: string): Promise<ShopMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const orders = await prisma.order.findMany({
    where: { shopId, createdAt: { gte: thirtyDaysAgo } },
    select: {
      status: true,
      createdAt: true,
      updatedAt: true,
      estimatedReady: true,
      actualReady: true,
    },
  });

  if (orders.length === 0) {
    return {
      acceptanceRate: null,
      avgPrepMinutes: null,
      cancelRate: null,
      responseMinutes: null,
      lateRate: null,
      avgRating: null,
    };
  }

  // Acceptance rate
  const accepted = orders.filter((o) =>
    ["ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED"].includes(o.status)
  ).length;
  const rejected = orders.filter((o) => o.status === "DENIED").length;
  const acceptanceRate = accepted + rejected > 0 ? accepted / (accepted + rejected) : null;

  // Cancel rate
  const cancelled = orders.filter((o) =>
    ["CANCELLED", "AUTO_CANCELLED"].includes(o.status)
  ).length;
  const cancelRate = orders.length > 0 ? cancelled / orders.length : null;

  // Response time (time from created to first status change for accepted orders)
  const acceptedOrders = orders.filter((o) =>
    ["ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED"].includes(o.status)
  );
  let responseMinutes: number | null = null;
  if (acceptedOrders.length > 0) {
    const responseTimes = acceptedOrders
      .map((o) => (o.updatedAt.getTime() - o.createdAt.getTime()) / 60_000)
      .filter((t) => t > 0 && t < 480);
    if (responseTimes.length > 0) {
      responseMinutes = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
  }

  // Avg prep minutes
  const withReady = orders.filter((o) => o.estimatedReady && o.actualReady);
  let avgPrepMinutes: number | null = null;
  if (withReady.length > 0) {
    const prepTimes = withReady.map(
      (o) => (o.actualReady!.getTime() - o.createdAt.getTime()) / 60_000
    );
    avgPrepMinutes = prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length;
  }

  // Late rate
  let lateRate: number | null = null;
  if (withReady.length > 0) {
    const lateCount = withReady.filter(
      (o) => o.actualReady!.getTime() > o.estimatedReady!.getTime()
    ).length;
    lateRate = lateCount / withReady.length;
  }

  // Average rating from reviews
  const ratingAgg = await prisma.review.aggregate({
    where: { shopId, createdAt: { gte: thirtyDaysAgo } },
    _avg: { rating: true },
  });
  const avgRating = ratingAgg._avg.rating;

  return {
    acceptanceRate,
    avgPrepMinutes,
    cancelRate,
    responseMinutes,
    lateRate,
    avgRating,
  };
}

/**
 * Compute a weighted performance score from 0-100.
 */
export function computePerformanceScore(metrics: ShopMetrics): number {
  let score = 100;
  let factors = 0;

  if (metrics.acceptanceRate !== null) {
    score += metrics.acceptanceRate * 25;
    factors += 25;
  }
  if (metrics.cancelRate !== null) {
    score += (1 - metrics.cancelRate) * 20;
    factors += 20;
  }
  if (metrics.responseMinutes !== null) {
    const responseScore = Math.max(0, 1 - metrics.responseMinutes / 60);
    score += responseScore * 15;
    factors += 15;
  }
  if (metrics.lateRate !== null) {
    score += (1 - metrics.lateRate) * 15;
    factors += 15;
  }
  if (metrics.avgRating !== null) {
    score += (metrics.avgRating / 5) * 25;
    factors += 25;
  }

  if (factors === 0) return 0;
  return Math.round(((score - 100) / factors) * 100);
}

/**
 * Generate alerts for a shop based on thresholds.
 */
export async function generateAlerts(
  shopId: string,
  metrics: ShopMetrics
): Promise<void> {
  const alerts: { type: string; message: string; severity: string }[] = [];

  if (metrics.responseMinutes !== null) {
    if (metrics.responseMinutes >= THRESHOLDS.responseMinutes.critical) {
      alerts.push({
        type: "SLOW_RESPONSE",
        message: `Temps de réponse moyen très élevé : ${Math.round(metrics.responseMinutes)} min`,
        severity: "critical",
      });
    } else if (metrics.responseMinutes >= THRESHOLDS.responseMinutes.warning) {
      alerts.push({
        type: "SLOW_RESPONSE",
        message: `Temps de réponse moyen élevé : ${Math.round(metrics.responseMinutes)} min`,
        severity: "warning",
      });
    }
  }

  if (metrics.cancelRate !== null) {
    if (metrics.cancelRate >= THRESHOLDS.cancelRate.critical) {
      alerts.push({
        type: "HIGH_CANCEL",
        message: `Taux d'annulation critique : ${Math.round(metrics.cancelRate * 100)}%`,
        severity: "critical",
      });
    } else if (metrics.cancelRate >= THRESHOLDS.cancelRate.warning) {
      alerts.push({
        type: "HIGH_CANCEL",
        message: `Taux d'annulation élevé : ${Math.round(metrics.cancelRate * 100)}%`,
        severity: "warning",
      });
    }
  }

  if (metrics.acceptanceRate !== null) {
    if (metrics.acceptanceRate <= THRESHOLDS.acceptanceRate.critical) {
      alerts.push({
        type: "LOW_ACCEPTANCE",
        message: `Taux d'acceptation très bas : ${Math.round(metrics.acceptanceRate * 100)}%`,
        severity: "critical",
      });
    } else if (metrics.acceptanceRate <= THRESHOLDS.acceptanceRate.warning) {
      alerts.push({
        type: "LOW_ACCEPTANCE",
        message: `Taux d'acceptation bas : ${Math.round(metrics.acceptanceRate * 100)}%`,
        severity: "warning",
      });
    }
  }

  if (metrics.lateRate !== null) {
    if (metrics.lateRate >= THRESHOLDS.lateRate.critical) {
      alerts.push({
        type: "HIGH_LATE",
        message: `Taux de retard critique : ${Math.round(metrics.lateRate * 100)}%`,
        severity: "critical",
      });
    } else if (metrics.lateRate >= THRESHOLDS.lateRate.warning) {
      alerts.push({
        type: "HIGH_LATE",
        message: `Taux de retard élevé : ${Math.round(metrics.lateRate * 100)}%`,
        severity: "warning",
      });
    }
  }

  if (metrics.avgRating !== null) {
    if (metrics.avgRating <= THRESHOLDS.avgRating.critical) {
      alerts.push({
        type: "LOW_RATING",
        message: `Note moyenne très basse : ${metrics.avgRating.toFixed(1)}/5`,
        severity: "critical",
      });
    } else if (metrics.avgRating <= THRESHOLDS.avgRating.warning) {
      alerts.push({
        type: "LOW_RATING",
        message: `Note moyenne basse : ${metrics.avgRating.toFixed(1)}/5`,
        severity: "warning",
      });
    }
  }

  // Batch fetch existing unresolved alerts (instead of N findFirst calls)
  const alertTypes = alerts.map(a => a.type);
  const existingAlerts = await prisma.shopAlert.findMany({
    where: { shopId, resolved: false },
  });
  const existingTypes = new Set(existingAlerts.map(a => a.type));

  // Create only missing alerts
  const newAlerts = alerts.filter(a => !existingTypes.has(a.type));
  if (newAlerts.length > 0) {
    await prisma.shopAlert.createMany({
      data: newAlerts.map(a => ({ shopId, ...a })),
    });
  }

  // Auto-resolve alerts that are no longer relevant (batch updateMany)
  const newAlertTypes = new Set(alertTypes);
  const toResolve = existingAlerts.filter(a => !newAlertTypes.has(a.type));
  if (toResolve.length > 0) {
    await prisma.shopAlert.updateMany({
      where: { id: { in: toResolve.map(a => a.id) } },
      data: { resolved: true },
    });
  }
}

/**
 * Full refresh: calculate metrics, update Shop, generate alerts.
 */
export async function refreshShopMetrics(shopId: string) {
  const metrics = await calculateShopMetrics(shopId);
  const score = computePerformanceScore(metrics);

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      cachedAcceptanceRate: metrics.acceptanceRate,
      cachedAvgPrepMinutes: metrics.avgPrepMinutes,
      cachedCancelRate: metrics.cancelRate,
      cachedResponseMinutes: metrics.responseMinutes,
      cachedLateRate: metrics.lateRate,
      cachedAvgRating: metrics.avgRating,
      performanceScore: score,
      metricsUpdatedAt: new Date(),
    },
  });

  await generateAlerts(shopId, metrics);

  return { metrics, score };
}

/**
 * Refresh metrics for all active shops.
 */
export async function refreshAllShopMetrics() {
  const shops = await prisma.shop.findMany({
    where: { visible: true },
    select: { id: true },
  });

  for (const shop of shops) {
    try {
      await refreshShopMetrics(shop.id);
    } catch (error) {
      console.error(`[Performance] Error refreshing shop ${shop.id}:`, error);
    }
  }

  console.log(`[Performance] Refreshed metrics for ${shops.length} shops`);
}
