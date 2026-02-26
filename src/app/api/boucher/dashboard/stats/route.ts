// GET /api/boucher/dashboard/stats — Lightweight today-only stats for the boucher dashboard
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ── 1. Auth ──
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    // ── 2. Date range: start of today ──
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── 3. Fetch today's orders ──
    const todayOrders = await prisma.order.findMany({
      where: {
        shopId,
        createdAt: { gte: todayStart },
      },
      select: {
        id: true,
        status: true,
        totalCents: true,
        createdAt: true,
        estimatedReady: true,
      },
      take: 500,
    });

    // ── 4. Compute stats ──
    const ordersToday = todayOrders.length;

    const completedStatuses = ["COMPLETED", "PICKED_UP"] as const;
    const completedOrders = todayOrders.filter((o) =>
      (completedStatuses as readonly string[]).includes(o.status)
    );
    const completedToday = completedOrders.length;

    const revenueToday = completedOrders.reduce(
      (sum, o) => sum + o.totalCents,
      0
    );

    const pendingCount = todayOrders.filter(
      (o) => o.status === "PENDING"
    ).length;

    // Average prep time (estimatedReady - createdAt) for accepted orders today
    const acceptedStatuses = [
      "ACCEPTED",
      "PREPARING",
      "READY",
      "PICKED_UP",
      "COMPLETED",
    ] as const;
    const ordersWithPrepTime = todayOrders.filter(
      (o) =>
        (acceptedStatuses as readonly string[]).includes(o.status) &&
        o.estimatedReady !== null
    );

    let avgPrepTime = 0;
    if (ordersWithPrepTime.length > 0) {
      const totalPrepMs = ordersWithPrepTime.reduce((sum, o) => {
        const diff =
          new Date(o.estimatedReady!).getTime() -
          new Date(o.createdAt).getTime();
        return sum + Math.max(0, diff);
      }, 0);
      avgPrepTime = Math.round(
        totalPrepMs / ordersWithPrepTime.length / 60_000
      ); // in minutes
    }

    return apiSuccess({
      ordersToday,
      revenueToday,
      pendingCount,
      avgPrepTime,
      completedToday,
    });
  } catch (error) {
    return handleApiError(error, "boucher/dashboard/stats/GET");
  }
}
