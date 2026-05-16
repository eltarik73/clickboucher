// src/app/api/cron/indexnow-fresh/route.ts
//
// Ping IndexNow quotidien sur les URLs business-critical pour rafraîchir
// l'index Bing/Copilot/ChatGPT Search.
//
// Schedule : 03:11 UTC daily (avant Bing crawl)
// Auth : Vercel Cron envoie Authorization: Bearer ${CRON_SECRET}
//
// URLs pingées :
//   - Homepage
//   - Toutes les SEO_CITIES (boucherie-halal/[ville])
//   - Toutes les SEO_CITIES (devenir-boucher-partenaire/[ville])
//   - Top boutiques actives (jusqu'à 20)
//
// Le ping freshness est un signal fort pour Perplexity/ChatGPT Search/Copilot.

import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { notifyIndexNow } from "@/lib/indexnow";
import { SEO_CITIES } from "@/lib/seo/cities";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const urls: string[] = [];

    // Homepage
    urls.push(`${SITE_URL}/`);
    urls.push(`${SITE_URL}/click-and-collect-halal`);

    // SEO_CITIES — 2 templates par ville
    for (const city of SEO_CITIES) {
      urls.push(`${SITE_URL}/boucherie-halal/${city.slug}`);
      urls.push(`${SITE_URL}/devenir-boucher-partenaire/${city.slug}`);
    }

    // Top boutiques actives (max 20, ordonnées par updatedAt récent)
    // Shop est "indexable" si visible=true et status != CLOSED/VACATION
    const activeShops = await prisma.shop
      .findMany({
        where: { visible: true, status: { in: ["OPEN", "BUSY", "PAUSED", "AUTO_PAUSED"] } },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
      .catch(() => []);

    for (const shop of activeShops) {
      urls.push(`${SITE_URL}/boutique/${shop.slug}`);
    }

    // Ping IndexNow
    await notifyIndexNow(urls);

    const summary = {
      date: new Date().toISOString().split("T")[0],
      pingedCount: urls.length,
      breakdown: {
        homepage: 2,
        cities: SEO_CITIES.length * 2,
        shops: activeShops.length,
      },
    };

    logger.info(`[indexnow-fresh] Pinged ${urls.length} URLs`, summary);
    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error, "cron/indexnow-fresh");
  }
}
