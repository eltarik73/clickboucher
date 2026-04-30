// GET /api/boucher/finances
//
// Renvoie les statistiques financières du boucher pour le mois courant.
// Inclut :
// - Stats agrégées (CA, commission, frais Stripe, payout) sur les commandes payées
// - Évolution jour par jour pour le graphique
// - Liste des 10 dernières commandes payées
// - Info palier + early adopter

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import {
  getEffectiveCommissionRate,
  TIER_THRESHOLDS,
  type ShopTier,
} from "@/lib/services/stripe/commission";

export async function GET() {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { shopId } = auth;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        tier: true,
        commissionMarkupPercent: true,
        priceRoundingEnabled: true,
        monthlyGmvCents: true,
        earlyAdopterUntil: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
      },
    });

    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    // ── Date ranges ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── Aggregate stats (paid orders this month) ──
    const aggregate = await prisma.order.aggregate({
      where: {
        shopId,
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

    const monthGmvCents = aggregate._sum.totalCents ?? 0;
    const monthCommissionCents = aggregate._sum.platformFeeCents ?? 0;
    const monthStripeFeeCents = aggregate._sum.stripeFeeCents ?? 0;
    const monthPayoutCents = aggregate._sum.shopPayoutCents ?? 0;
    const monthOrderCount = aggregate._count._all;

    // ── Daily evolution (group by createdAt date) ──
    const paidOrders = await prisma.order.findMany({
      where: {
        shopId,
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      select: {
        paidAt: true,
        totalCents: true,
        platformFeeCents: true,
        shopPayoutCents: true,
      },
    });

    // Group by day (YYYY-MM-DD)
    const dailyMap = new Map<string, { gmv: number; commission: number; payout: number; count: number }>();
    for (const o of paidOrders) {
      if (!o.paidAt) continue;
      const key = o.paidAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(key) ?? { gmv: 0, commission: 0, payout: 0, count: 0 };
      existing.gmv += o.totalCents;
      existing.commission += o.platformFeeCents;
      existing.payout += o.shopPayoutCents;
      existing.count += 1;
      dailyMap.set(key, existing);
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Recent orders (10) ──
    const recentOrders = await prisma.order.findMany({
      where: {
        shopId,
        paidAt: { not: null },
      },
      orderBy: { paidAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        displayNumber: true,
        totalCents: true,
        platformFeeCents: true,
        serviceFeeCents: true,
        shopPayoutCents: true,
        paidAt: true,
        paymentMethod: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    // ── Tier info ──
    const tier = shop.tier as ShopTier;
    const isEarlyAdopter =
      shop.earlyAdopterUntil !== null && new Date(shop.earlyAdopterUntil) > now;
    const effectiveRate = getEffectiveCommissionRate({
      tier,
      earlyAdopterUntil: shop.earlyAdopterUntil,
    });

    // Next tier threshold
    const nextTierKey: ShopTier | null =
      tier === "BRONZE" ? "SILVER" : tier === "SILVER" ? "GOLD" : tier === "GOLD" ? "PLATINUM" : null;
    const nextTierMinCents = nextTierKey ? TIER_THRESHOLDS[nextTierKey].min : null;
    const remainingToNextTierCents =
      nextTierMinCents !== null ? Math.max(0, nextTierMinCents - monthGmvCents) : null;

    // Early adopter days remaining
    const earlyAdopterDaysRemaining =
      shop.earlyAdopterUntil
        ? Math.max(
            0,
            Math.ceil((new Date(shop.earlyAdopterUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0;

    return apiSuccess({
      shop: {
        id: shop.id,
        name: shop.name,
        tier,
        commissionMarkupPercent: shop.commissionMarkupPercent,
        priceRoundingEnabled: shop.priceRoundingEnabled,
        stripeAccountId: shop.stripeAccountId,
        stripeChargesEnabled: shop.stripeChargesEnabled,
      },
      tierInfo: {
        tier,
        effectiveRate,
        baseRate: TIER_THRESHOLDS[tier].rate,
        isEarlyAdopter,
        earlyAdopterUntil: shop.earlyAdopterUntil,
        earlyAdopterDaysRemaining,
        nextTier: nextTierKey,
        nextTierMinCents,
        remainingToNextTierCents,
      },
      month: {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
        gmvCents: monthGmvCents,
        commissionCents: monthCommissionCents,
        stripeFeeCents: monthStripeFeeCents,
        payoutCents: monthPayoutCents,
        orderCount: monthOrderCount,
      },
      daily,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.displayNumber || o.orderNumber,
        totalCents: o.totalCents,
        platformFeeCents: o.platformFeeCents,
        serviceFeeCents: o.serviceFeeCents,
        shopPayoutCents: o.shopPayoutCents,
        paidAt: o.paidAt,
        paymentMethod: o.paymentMethod,
        customerName: o.user
          ? `${o.user.firstName.charAt(0).toUpperCase() + o.user.firstName.slice(1).toLowerCase()}.${o.user.lastName.charAt(0).toUpperCase()}`
          : "Client",
      })),
    });
  } catch (err) {
    return handleApiError(err, "boucher/finances");
  }
}
