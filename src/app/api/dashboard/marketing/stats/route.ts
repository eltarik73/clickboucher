// src/app/api/dashboard/marketing/stats/route.ts — Marketing KPIs (admin)
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET — Marketing KPIs ──────────────────────────────────────
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeOffers,
      campaignsThisMonth,
      ordersWithOffer,
      campaignsSentThisMonth,
    ] = await Promise.all([
      // Active offers count
      prisma.offer.count({ where: { status: "ACTIVE" } }),

      // Campaigns created this month
      prisma.campaign.count({
        where: { createdAt: { gte: startOfMonth } },
      }),

      // Orders with an offer this month
      prisma.order.findMany({
        where: {
          offerId: { not: null },
          createdAt: { gte: startOfMonth },
        },
        select: { totalCents: true },
      }),

      // Sum of sentCount from campaigns this month
      prisma.campaign.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { sentCount: true },
      }),
    ]);

    const conversions = ordersWithOffer.length;
    const revenueViaOffersCents = ordersWithOffer.reduce(
      (sum, o) => sum + o.totalCents,
      0
    );
    const revenueViaOffers = revenueViaOffersCents / 100;
    const emailsSent = campaignsSentThisMonth._sum.sentCount || 0;
    const roi = revenueViaOffers / (conversions * 5 || 1);

    return apiSuccess({
      activeOffers,
      campaignsThisMonth,
      conversions,
      emailsSent,
      revenueViaOffers,
      roi: Math.round(roi * 100) / 100,
    });
  } catch (error) {
    return handleApiError(error, "dashboard/marketing/stats GET");
  }
}
