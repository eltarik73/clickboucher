import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const currentHour = new Date().getHours();

    const premiumFeatures = await prisma.planFeature.findMany({
      where: { plan: "PREMIUM", featureKey: { startsWith: "auto_promos_" }, enabled: true },
    });

    if (premiumFeatures.length === 0) {
      return apiSuccess({ promoCount: 0, timestamp: new Date().toISOString() });
    }

    let totalPromos = 0;

    for (const feature of premiumFeatures) {
      try {
        const shopId = feature.featureKey.replace("auto_promos_", "");
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Use groupBy instead of fetching all raw orders
        const hourlyOrders = await prisma.order.groupBy({
          by: ["createdAt"],
          where: { shopId, createdAt: { gte: weekAgo } },
          _count: true,
        });

        const hourCounts = new Map<number, number>();
        for (let h = 0; h < 24; h++) hourCounts.set(h, 0);
        for (const o of hourlyOrders) {
          const h = new Date(o.createdAt).getHours();
          hourCounts.set(h, (hourCounts.get(h) || 0) + o._count);
        }

        const peak = Math.max(...hourCounts.values(), 1);
        const isOffPeak = (hourCounts.get(currentHour) || 0) < peak * 0.2;

        if (isOffPeak) {
          const promoEnd = new Date();
          promoEnd.setHours(promoEnd.getHours() + 1);

          const result = await prisma.product.updateMany({
            where: { shopId, featured: true, inStock: true, promoPct: null },
            data: { promoPct: 10, promoType: "FLASH", promoEnd },
          });
          totalPromos += result.count;
        }
      } catch {
        // Continue
      }
    }

    return apiSuccess({ promoCount: totalPromos, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/auto-promos");
  }
}
