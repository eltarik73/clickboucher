// GET /api/cron/indexnow-fresh — daily IndexNow ping of the pages that changed.
//
// Schedule: 03:11 UTC daily (vercel.json). Auth: Vercel Cron sends Authorization: Bearer
// ${CRON_SECRET}.
//
// Sends the sitemap pages whose lastmod moved since the start of the previous UTC day
// (src/lib/seo/indexnow-urls.ts), so an unchanged page is never resubmitted, and nothing at all on
// a day without change. The URL set is the sitemap's (src/lib/seo/sitemap-entries.ts): never a
// shop page. The transport only sends from the production deployment.

import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { notifyIndexNow } from "@/lib/indexnow";
import { countFreshByFamily, freshIndexNowUrls } from "@/lib/seo/indexnow-urls";
import { loadSitemapData } from "@/lib/seo/sitemap-data";
import { buildSitemapEntries } from "@/lib/seo/sitemap-entries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const now = new Date();
    const entries = buildSitemapEntries(await loadSitemapData());
    const urls = freshIndexNowUrls(entries, now);
    if (urls.length > 0) await notifyIndexNow(urls);

    const summary = {
      date: now.toISOString().slice(0, 10),
      urlCount: urls.length,
      byFamily: countFreshByFamily(entries, now),
    };
    logger.info(`[indexnow-fresh] ${urls.length} changed URL(s)`, summary);
    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error, "cron/indexnow-fresh");
  }
}
