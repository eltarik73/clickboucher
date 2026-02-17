// GET /api/boucher/stats?period=week|month|year — Boucher dashboard statistics
// Feature-gated by subscription plan: STARTER=basic, PRO=advanced charts, PREMIUM=off-peak
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── Helpers ──────────────────────────────────────

type Period = "week" | "month" | "year";

function getDateRange(period: Period): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setDate(start.getDate() - 30);
      break;
    case "year":
      start.setDate(start.getDate() - 365);
      break;
  }

  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Generate an array of day keys between start and end */
function generateDayKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    keys.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

/** Generate an array of month keys between start and end */
function generateMonthKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    keys.push(formatMonth(current));
    current.setMonth(current.getMonth() + 1);
  }
  return keys;
}

// ── GET Handler ──────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ── 1. Auth ──
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true, rating: true, ratingCount: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    // ── 2. Subscription check ──
    const subscription = await prisma.subscription.findUnique({
      where: { shopId: shop.id },
    });

    const plan: "STARTER" | "PRO" | "PREMIUM" = subscription?.plan ?? "STARTER";
    const isPro = plan === "PRO" || plan === "PREMIUM";
    const isPremium = plan === "PREMIUM";

    // ── 3. Period ──
    const periodParam = req.nextUrl.searchParams.get("period") || "week";
    if (!["week", "month", "year"].includes(periodParam)) {
      return apiError("VALIDATION_ERROR", "Periode invalide (week, month, year)");
    }
    const period = periodParam as Period;
    const { start, end } = getDateRange(period);

    // ── 4. Fetch orders for the period ──
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [periodOrders, ordersToday] = await Promise.all([
      prisma.order.findMany({
        where: {
          shopId: shop.id,
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          status: true,
          totalCents: true,
          createdAt: true,
          estimatedReady: true,
          items: {
            select: {
              productId: true,
              name: true,
              quantity: true,
              totalCents: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.order.count({
        where: {
          shopId: shop.id,
          createdAt: { gte: todayStart },
        },
      }),
    ]);

    // ── 5. Basic stats (ALL plans) ──
    const completedStatuses = ["COMPLETED", "PICKED_UP"] as const;
    const completedOrders = periodOrders.filter((o) =>
      (completedStatuses as readonly string[]).includes(o.status)
    );

    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalCents, 0);
    const totalOrders = periodOrders.length;
    const avgOrderValue = completedOrders.length > 0
      ? Math.round(totalRevenue / completedOrders.length)
      : 0;

    const completedCount = completedOrders.length;
    const completionRate = totalOrders > 0
      ? Math.round((completedCount / totalOrders) * 100)
      : 0;

    const basicStats = {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      rating: shop.rating,
      ratingCount: shop.ratingCount,
      completionRate,
      ordersToday,
      period,
      plan,
    };

    // ── STARTER plan: return basic stats only ──
    if (!isPro) {
      return apiSuccess(basicStats);
    }

    // ── 6. Advanced stats (PRO + PREMIUM) ──
    const useMonthGrouping = period === "year";

    // Revenue chart
    const revenueMap = new Map<string, number>();
    const ordersMap = new Map<string, number>();

    for (const order of completedOrders) {
      const key = useMonthGrouping
        ? formatMonth(order.createdAt)
        : formatDate(order.createdAt);

      revenueMap.set(key, (revenueMap.get(key) || 0) + order.totalCents);
      ordersMap.set(key, (ordersMap.get(key) || 0) + 1);
    }

    // Also count all orders (not just completed) in ordersChart
    const allOrdersMap = new Map<string, number>();
    for (const order of periodOrders) {
      const key = useMonthGrouping
        ? formatMonth(order.createdAt)
        : formatDate(order.createdAt);

      allOrdersMap.set(key, (allOrdersMap.get(key) || 0) + 1);
    }

    const dateKeys = useMonthGrouping
      ? generateMonthKeys(start, end)
      : generateDayKeys(start, end);

    const revenueChart = dateKeys.map((date) => ({
      date,
      revenue: revenueMap.get(date) || 0,
    }));

    const ordersChart = dateKeys.map((date) => ({
      date,
      orders: allOrdersMap.get(date) || 0,
    }));

    // Hourly distribution
    const hourlyMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
    for (const order of periodOrders) {
      const hour = order.createdAt.getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }
    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      orders: hourlyMap.get(h) || 0,
    }));

    // Top products by revenue
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of completedOrders) {
      for (const item of order.items) {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.totalCents;
        } else {
          productMap.set(item.productId, {
            name: item.name,
            quantity: item.quantity,
            revenue: item.totalCents,
          });
        }
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top clients by order count
    const clientMap = new Map<string, { name: string; orderCount: number; totalSpent: number }>();
    for (const order of completedOrders) {
      const clientId = order.user.id;
      const existing = clientMap.get(clientId);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += order.totalCents;
      } else {
        clientMap.set(clientId, {
          name: `${order.user.firstName} ${order.user.lastName}`,
          orderCount: 1,
          totalSpent: order.totalCents,
        });
      }
    }
    const topClients = Array.from(clientMap.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5);

    // Average prep time (estimatedReady - createdAt) for accepted orders
    const acceptedStatuses = ["ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED"] as const;
    const ordersWithPrepTime = periodOrders.filter(
      (o) =>
        (acceptedStatuses as readonly string[]).includes(o.status) &&
        o.estimatedReady !== null
    );

    let avgPrepTime = 0;
    if (ordersWithPrepTime.length > 0) {
      const totalPrepMs = ordersWithPrepTime.reduce((sum, o) => {
        const diff = new Date(o.estimatedReady!).getTime() - new Date(o.createdAt).getTime();
        return sum + Math.max(0, diff);
      }, 0);
      avgPrepTime = Math.round(totalPrepMs / ordersWithPrepTime.length / 60_000); // in minutes
    }

    const advancedStats = {
      ...basicStats,
      revenueChart,
      ordersChart,
      hourlyDistribution,
      topProducts,
      topClients,
      avgPrepTime,
    };

    // ── PRO plan: return advanced stats ──
    if (!isPremium) {
      return apiSuccess(advancedStats);
    }

    // ── 7. Premium stats ──
    const peakVolume = Math.max(...hourlyDistribution.map((h) => h.orders), 1);
    const threshold = peakVolume * 0.2;
    const offPeakHours = hourlyDistribution
      .filter((h) => h.orders < threshold)
      .map((h) => h.hour);

    return apiSuccess({
      ...advancedStats,
      offPeakHours,
    });
  } catch (error) {
    return handleApiError(error, "boucher/stats/GET");
  }
}
