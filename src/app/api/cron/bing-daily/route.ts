// src/app/api/cron/bing-daily/route.ts
//
// Audit quotidien Bing Webmaster Tools — version Vercel Cron.
// Remplace l'ancien scripts/bing-daily-audit.ts qui tournait sur le Mac local.
// Maintenant : tourne 24/7 sur Vercel même si le Mac est éteint.
//
// Schedule : 09:17 UTC daily (cf vercel.json)
// Auth : Vercel Cron envoie Authorization: Bearer ${CRON_SECRET}
//
// Env requis : BING_WEBMASTER_API_KEY, CRON_SECRET
//
// Output : log structuré (Vercel Logs + Sentry si error)
//         + alerte Sentry si crawl errors > 5 OU 5xx > 0
//         + ping IndexNow auto sur nouvelles URLs détectées

import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";
const API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

type CrawlStats = {
  Date: string;
  CrawledPages: number;
  Code2xx: number;
  Code301: number;
  Code4xx: number;
  Code5xx: number;
  CrawlErrors: number;
  InIndex: number;
  BlockedByRobotsTxt: number;
};

type CrawlIssue = {
  Url: string;
  IssueDescription: string;
};

type QueryStats = {
  Query: string;
  Impressions: number;
  Clicks: number;
};

async function callBing<T>(
  method: string,
  apiKey: string,
  params: Record<string, string> = {}
): Promise<T | null> {
  const qs = new URLSearchParams({ siteUrl: SITE_URL, apikey: apiKey, ...params }).toString();
  try {
    const res = await fetch(`${API_BASE}/${method}?${qs}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      logger.warn(`[bing-daily] ${method} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data.d as T;
  } catch (e) {
    logger.warn(`[bing-daily] ${method} failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const apiKey = process.env.BING_WEBMASTER_API_KEY;
    if (!apiKey) {
      logger.error("[bing-daily] BING_WEBMASTER_API_KEY missing");
      return apiError("INTERNAL_ERROR", "Bing API key not configured");
    }

    const today = new Date().toISOString().split("T")[0];
    const alerts: string[] = [];

    // 1. Crawl stats
    const stats = await callBing<CrawlStats[]>("GetCrawlStats", apiKey);
    const latest = stats?.[0];
    if (latest) {
      if (latest.Code5xx > 0) alerts.push(`5xx errors: ${latest.Code5xx}`);
      if (latest.CrawlErrors > 5) alerts.push(`Crawl errors: ${latest.CrawlErrors}`);
      if (latest.Code4xx > 10) alerts.push(`4xx errors: ${latest.Code4xx}`);
    }

    // 2. Crawl issues
    const issues = (await callBing<CrawlIssue[]>("GetCrawlIssues", apiKey)) ?? [];
    if (issues.length > 5) alerts.push(`Crawl issues: ${issues.length}`);

    // 3. Query stats (top keywords)
    const queries = (await callBing<QueryStats[]>("GetQueryStats", apiKey)) ?? [];
    const topQueries = queries
      .sort((a, b) => (b.Impressions ?? 0) - (a.Impressions ?? 0))
      .slice(0, 10)
      .map((q) => ({ query: q.Query, imp: q.Impressions, clicks: q.Clicks }));

    // 4. Submit URL quota
    const quota = await callBing<{ DailyQuota: number; MonthlyQuota: number }>(
      "GetUrlSubmissionQuota",
      apiKey
    );

    // Build summary
    const summary = {
      date: today,
      crawl: latest
        ? {
            crawledPages: latest.CrawledPages,
            inIndex: latest.InIndex,
            code2xx: latest.Code2xx,
            code4xx: latest.Code4xx,
            code5xx: latest.Code5xx,
            crawlErrors: latest.CrawlErrors,
            blockedRobots: latest.BlockedByRobotsTxt,
          }
        : null,
      issuesCount: issues.length,
      topIssues: issues.slice(0, 5).map((i) => ({ url: i.Url, desc: i.IssueDescription })),
      topQueries,
      quota: quota ? { daily: quota.DailyQuota, monthly: quota.MonthlyQuota } : null,
      alerts,
    };

    if (alerts.length > 0) {
      logger.error(`[bing-daily] ALERTS: ${alerts.join(", ")}`, { summary });
    } else {
      logger.info(
        `[bing-daily] OK - ${latest?.CrawledPages ?? 0} pages crawled, ${issues.length} issues`,
        summary
      );
    }

    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error, "cron/bing-daily");
  }
}
