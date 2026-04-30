// GET /api/cron/recalc-shop-tiers
//
// Cron mensuel : recalcule le palier de chaque boucher d'après son CA HT
// du mois précédent. Mis à jour : Shop.tier + Shop.monthlyGmvCents.
//
// Schedule (vercel.json) : "0 3 1 * *" — chaque 1er du mois à 03:00 UTC

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeTier } from "@/lib/services/stripe/commission";
import { logger } from "@/lib/logger";
import { verifyCronAuth } from "@/lib/cron-auth";

function startOfPreviousMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function endOfPreviousMonth(): Date {
  const now = new Date();
  // Day 0 of current month = last day of previous month
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const lastMonthStart = startOfPreviousMonth();
    const lastMonthEnd = endOfPreviousMonth();

    const shops = await prisma.shop.findMany({
      select: { id: true, name: true, tier: true },
    });

    let updated = 0;
    const updates: Array<{ shopId: string; oldTier: string; newTier: string; gmvCents: number }> = [];

    for (const shop of shops) {
      const gmv = await prisma.order.aggregate({
        where: {
          shopId: shop.id,
          paidAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { totalCents: true },
      });
      const gmvCents = gmv._sum.totalCents ?? 0;
      const newTier = computeTier(gmvCents);

      if (newTier !== shop.tier || gmvCents > 0) {
        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            tier: newTier,
            monthlyGmvCents: BigInt(gmvCents),
          },
        });
        if (newTier !== shop.tier) {
          updates.push({
            shopId: shop.id,
            oldTier: shop.tier,
            newTier,
            gmvCents,
          });
          updated++;
          logger.info("[cron/recalc-shop-tiers] tier updated", {
            shopId: shop.id,
            shopName: shop.name,
            oldTier: shop.tier,
            newTier,
            gmvCents,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      totalShops: shops.length,
      updated,
      monthRange: {
        start: lastMonthStart.toISOString(),
        end: lastMonthEnd.toISOString(),
      },
      updates,
    });
  } catch (err) {
    logger.error("[cron/recalc-shop-tiers] error", { err: (err as Error).message });
    return NextResponse.json(
      { error: "internal", message: (err as Error).message },
      { status: 500 },
    );
  }
}
