// GET /api/webmaster/finances
//
// Vue globale Klik&Go marketplace :
// - Stats du mois courant (CA total, commissions, frais service, frais Stripe, profit net)
// - Top 10 bouchers par CA mois courant
// - Distribution paliers
// - Évolution mensuelle 6 derniers mois
// - 50 dernières commandes payées (avec filtre boucher optionnel)

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const filterShopId = searchParams.get("shopId");

    // ── Date ranges ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── Aggregate month stats ──
    const monthAggregate = await prisma.order.aggregate({
      where: {
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: {
        totalCents: true,
        platformFeeCents: true,
        serviceFeeCents: true,
        stripeFeeCents: true,
        shopPayoutCents: true,
        commissionCents: true,
      },
      _count: { _all: true },
    });

    const monthGmvCents = monthAggregate._sum.totalCents ?? 0;
    const monthPlatformFeeCents = monthAggregate._sum.platformFeeCents ?? 0;
    const monthServiceFeeCents = monthAggregate._sum.serviceFeeCents ?? 0;
    const monthStripeFeeCents = monthAggregate._sum.stripeFeeCents ?? 0;
    const monthOrderCount = monthAggregate._count._all;

    // commission % only (sans frais service)
    const monthCommissionOnlyCents = monthPlatformFeeCents - monthServiceFeeCents;

    // Profit net = commissions + frais service - frais Stripe
    const monthNetProfitCents = monthPlatformFeeCents - monthStripeFeeCents;

    // ── Top 10 bouchers par CA mois courant ──
    const topShopsRaw = await prisma.order.groupBy({
      by: ["shopId"],
      where: { paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: {
        totalCents: true,
        platformFeeCents: true,
        shopPayoutCents: true,
      },
      _count: { _all: true },
      orderBy: { _sum: { totalCents: "desc" } },
      take: 10,
    });

    const topShopIds = topShopsRaw.map((s) => s.shopId);
    const shopsInfo = await prisma.shop.findMany({
      where: { id: { in: topShopIds } },
      select: { id: true, name: true, slug: true, tier: true, city: true },
    });
    const shopMap = new Map(shopsInfo.map((s) => [s.id, s]));

    const topShops = topShopsRaw.map((s) => {
      const info = shopMap.get(s.shopId);
      return {
        shopId: s.shopId,
        name: info?.name ?? "—",
        slug: info?.slug ?? "",
        city: info?.city ?? "",
        tier: info?.tier ?? "BRONZE",
        gmvCents: s._sum.totalCents ?? 0,
        platformFeeCents: s._sum.platformFeeCents ?? 0,
        payoutCents: s._sum.shopPayoutCents ?? 0,
        orderCount: s._count._all,
      };
    });

    // ── Distribution paliers ──
    const tierDistribution = await prisma.shop.groupBy({
      by: ["tier"],
      _count: { _all: true },
    });
    const tierMap: Record<string, number> = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    };
    for (const row of tierDistribution) {
      tierMap[row.tier] = row._count._all;
    }

    // ── Évolution 6 derniers mois ──
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyOrders = await prisma.order.findMany({
      where: { paidAt: { gte: sixMonthsAgo } },
      select: {
        paidAt: true,
        totalCents: true,
        platformFeeCents: true,
        shopPayoutCents: true,
      },
    });

    const monthlyMap = new Map<string, { gmv: number; commission: number; payout: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, { gmv: 0, commission: 0, payout: 0, count: 0 });
    }
    for (const o of monthlyOrders) {
      if (!o.paidAt) continue;
      const key = `${o.paidAt.getFullYear()}-${String(o.paidAt.getMonth() + 1).padStart(2, "0")}`;
      const ex = monthlyMap.get(key);
      if (!ex) continue;
      ex.gmv += o.totalCents;
      ex.commission += o.platformFeeCents;
      ex.payout += o.shopPayoutCents;
      ex.count += 1;
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v }));

    // ── 50 dernières commandes ──
    const recentOrders = await prisma.order.findMany({
      where: {
        paidAt: { not: null },
        ...(filterShopId ? { shopId: filterShopId } : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        displayNumber: true,
        totalCents: true,
        platformFeeCents: true,
        serviceFeeCents: true,
        stripeFeeCents: true,
        shopPayoutCents: true,
        paidAt: true,
        paymentMethod: true,
        shop: { select: { id: true, name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    // ── List of shops for filter dropdown ──
    const allShops = await prisma.shop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return apiSuccess({
      month: {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
        gmvCents: monthGmvCents,
        commissionOnlyCents: monthCommissionOnlyCents,
        serviceFeeCents: monthServiceFeeCents,
        platformFeeCents: monthPlatformFeeCents,
        stripeFeeCents: monthStripeFeeCents,
        netProfitCents: monthNetProfitCents,
        orderCount: monthOrderCount,
      },
      topShops,
      tierDistribution: tierMap,
      monthlyTrend,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.displayNumber || o.orderNumber,
        totalCents: o.totalCents,
        platformFeeCents: o.platformFeeCents,
        serviceFeeCents: o.serviceFeeCents,
        stripeFeeCents: o.stripeFeeCents,
        shopPayoutCents: o.shopPayoutCents,
        paidAt: o.paidAt,
        paymentMethod: o.paymentMethod,
        shop: o.shop,
        customerName: o.user
          ? `${o.user.firstName.charAt(0).toUpperCase() + o.user.firstName.slice(1).toLowerCase()}.${o.user.lastName.charAt(0).toUpperCase()}`
          : "Client",
      })),
      allShops,
    });
  } catch (err) {
    return handleApiError(err, "webmaster/finances");
  }
}
