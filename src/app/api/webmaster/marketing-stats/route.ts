// GET /api/webmaster/marketing-stats — Marketing performance analytics
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel queries for performance
    const [
      activeOffers,
      campaignsThisMonth,
      ordersWithPromo,
      totalEmailsSent,
      topCodes,
      totalDiscountGiven,
      allCampaigns,
    ] = await Promise.all([
      // Active offers count
      prisma.promoCode.count({ where: { status: "ACTIVE" } }),
      // Campaigns this month
      prisma.marketingCampaign.count({ where: { createdAt: { gte: monthStart } } }),
      // Orders with promo this month
      prisma.order.count({
        where: {
          promoCodeId: { not: null },
          createdAt: { gte: monthStart },
          status: { notIn: ["CANCELLED", "DENIED", "AUTO_CANCELLED"] },
        },
      }),
      // Total emails sent this month
      prisma.marketingCampaign.aggregate({
        where: { sentAt: { gte: monthStart } },
        _sum: { sentCount: true },
      }),
      // Top codes by usage
      prisma.promoCode.findMany({
        where: { currentUses: { gt: 0 } },
        select: {
          id: true,
          code: true,
          label: true,
          discountType: true,
          valueCents: true,
          valuePercent: true,
          currentUses: true,
          payer: true,
          _count: { select: { orders: true } },
        },
        orderBy: { currentUses: "desc" },
        take: 10,
      }),
      // Total discount given this month
      prisma.order.aggregate({
        where: {
          promoCodeId: { not: null },
          createdAt: { gte: monthStart },
          status: { notIn: ["CANCELLED", "DENIED", "AUTO_CANCELLED"] },
        },
        _sum: { discountCents: true, totalCents: true },
      }),
      // Campaign performance
      prisma.marketingCampaign.findMany({
        where: { sentAt: { not: null } },
        select: {
          id: true,
          name: true,
          type: true,
          segment: true,
          sentCount: true,
          openCount: true,
          clickCount: true,
          ordersCount: true,
          impressions: true,
        },
        orderBy: { sentAt: "desc" },
        take: 20,
      }),
    ]);

    // Compute campaign stats grouped by segment
    const clientCampaigns = allCampaigns.filter((c) => c.segment !== "BUTCHERS");
    const boucherCampaigns = allCampaigns.filter((c) => c.segment === "BUTCHERS");

    const computeRates = (campaigns: typeof allCampaigns) => {
      const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
      const totalOpen = campaigns.reduce((s, c) => s + c.openCount, 0);
      const totalClick = campaigns.reduce((s, c) => s + c.clickCount, 0);
      return {
        totalSent,
        openRate: totalSent > 0 ? Math.round((totalOpen / totalSent) * 100) : 0,
        clickRate: totalSent > 0 ? Math.round((totalClick / totalSent) * 100) : 0,
      };
    };

    const discountTotal = totalDiscountGiven._sum?.discountCents || 0;
    const revenueFromPromos = totalDiscountGiven._sum?.totalCents || 0;
    const roi = discountTotal > 0 ? Math.round((revenueFromPromos / discountTotal) * 100) / 100 : 0;

    return apiSuccess({
      kpis: {
        activeOffers,
        campaignsThisMonth,
        conversions: ordersWithPromo,
        emailsSent: totalEmailsSent._sum?.sentCount || 0,
      },
      topCodes,
      monthlyStats: {
        ordersWithPromo,
        revenueFromPromos,
        discountTotal,
        roi,
        emailsSent: totalEmailsSent._sum?.sentCount || 0,
      },
      campaignPerformance: {
        clients: computeRates(clientCampaigns),
        bouchers: computeRates(boucherCampaigns),
      },
    });
  } catch (error) {
    return handleApiError(error, "webmaster/marketing-stats/GET");
  }
}
