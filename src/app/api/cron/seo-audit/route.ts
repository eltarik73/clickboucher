// src/app/api/cron/seo-audit/route.ts
//
// Daily read-only SEO audit of the live site (10:11 UTC, vercel.json; Vercel Cron sends
// Authorization: Bearer ${CRON_SECRET}). It only sends GET requests to the site's own pages and
// submits nothing to any search engine. The checks are pure (src/lib/seo/audit-checks.ts):
// - sitemap.xml: at least 100 URLs, every city page, no /boutique/ page, no refused URL;
// - robots.txt: answers with a Sitemap line;
// - home: 200, indexable, title, its own canonical;
// - every city page, the Chambéry partner page, the Savoie department and the Aïd al-Adha page of
//   Chambéry: indexable, no shop entity, Product, rating, review or Event in the JSON-LD, no
//   forbidden claim (rule OR of the seo-anti-penalty skill: these pages stay indexed);
// - /sign-in and /sign-up: noindex; an unknown shop and an unknown city: a real 404;
// - the newest listed shops: no rating beyond their verified reviews, none on a Product.
// Every problem becomes an alert line; any alert is logged with logger.error (Sentry in production).

import type { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { loadVerifiedShopRating } from "@/lib/reviews/verified-rating";
import {
  alertLines,
  bodyProblems,
  indexablePageProblems,
  listPageProblems,
  mustBeNoindexProblems,
  mustBeNotFoundProblems,
  robotsTxtProblems,
  shopPageProblems,
  sitemapProblems,
  type PageCheck,
  type PageSnapshot,
} from "@/lib/seo/audit-checks";
import { SEO_CITIES } from "@/lib/seo/cities";
import {
  cityPath,
  departmentPath,
  occasionCityPath,
  partnerPath,
  shopPath,
} from "@/lib/seo/routes";
import { SITE_URL } from "@/lib/seo/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_TIMEOUT_MS = 10_000;
// The whole audit ends before the 30 s limit of API functions (vercel.json), so that it always
// reports: a request still pending at this deadline is aborted and counts as unreachable.
const AUDIT_DEADLINE_MS = 24_000;
const BATCH_SIZE = 10;
const SHOPS_CHECKED = 3;

const CITY_PATHS = SEO_CITIES.map((city) => cityPath(city.slug));
// Business-critical pages beside the cities: they must stay indexed and clean.
const OTHER_LIST_PATHS = [
  partnerPath("chambery"),
  departmentPath("savoie"),
  occasionCityPath("aid-al-adha", "chambery"),
];
const NOINDEX_PATHS = ["/sign-in", "/sign-up"];
const NOT_FOUND_PATHS = [shopPath("__audit-absent__"), cityPath("__audit-absent__")];

type CheckResult = { url: string; status: "ok" | "warn" | "error"; detail: string };

// What a crawler sees: browser Accept header, redirects not followed (a 3xx is reported as such),
// no Next.js data cache. A page that does not answer in time is a snapshot with status 0.
async function fetchSnapshot(path: string, deadline: AbortSignal): Promise<PageSnapshot> {
  try {
    const response = await fetch(`${SITE_URL}${path}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KlikGoSeoAudit/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([AbortSignal.timeout(PAGE_TIMEOUT_MS), deadline]),
    });
    const html = await response.text();
    return {
      path,
      status: response.status,
      html,
      xRobotsTag: response.headers.get("x-robots-tag"),
    };
  } catch (error) {
    // Timeout or network failure: reported as an unreachable page by the checks, cause logged here.
    logger.warn("[seo-audit] page unreachable", {
      path,
      cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    return { path, status: 0, html: null, xRobotsTag: null };
  }
}

async function inBatches<T, R>(items: readonly T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    results.push(...(await Promise.all(items.slice(start, start + BATCH_SIZE).map(run))));
  }
  return results;
}

function toResult({ path, problems }: PageCheck): CheckResult {
  return problems.length === 0
    ? { url: path, status: "ok", detail: "OK" }
    : { url: path, status: "error", detail: problems.join(" ; ") };
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const deadline = AbortSignal.timeout(AUDIT_DEADLINE_MS);
    const snapshot = (path: string) => fetchSnapshot(path, deadline);
    const audit = async (
      path: string,
      check: (page: PageSnapshot) => string[]
    ): Promise<PageCheck> => ({
      path,
      problems: check(await snapshot(path)),
    });

    const [shops, sitemap, robots, home, noindexChecks, notFoundChecks] = await Promise.all([
      // Listed shops (src/lib/shop-publication.ts), newest first: public pages, read-only.
      prisma.shop.findMany({
        where: { visible: true, suspendedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: SHOPS_CHECKED,
        select: { id: true, slug: true },
      }),
      audit("/sitemap.xml", (page) =>
        bodyProblems(page, (xml) => sitemapProblems(xml, CITY_PATHS))
      ),
      audit("/robots.txt", robotsTxtProblems),
      audit("/", indexablePageProblems),
      Promise.all(NOINDEX_PATHS.map((path) => audit(path, mustBeNoindexProblems))),
      Promise.all(NOT_FOUND_PATHS.map((path) => audit(path, mustBeNotFoundProblems))),
    ]);
    const listChecks = await inBatches([...CITY_PATHS, ...OTHER_LIST_PATHS], (path) =>
      audit(path, listPageProblems)
    );
    const shopChecks = await Promise.all(
      shops.map(async (shop) => {
        const [page, rating] = await Promise.all([
          snapshot(shopPath(shop.slug)),
          loadVerifiedShopRating(shop.id),
        ]);
        // loadVerifiedShopRating is null exactly when the shop has no verified review.
        return { path: page.path, problems: shopPageProblems(page, rating?.count ?? 0) };
      })
    );

    const checks = [
      sitemap,
      robots,
      home,
      ...noindexChecks,
      ...notFoundChecks,
      ...listChecks,
      ...shopChecks,
    ];
    const results = checks.map(toResult);
    if (shops.length === 0) {
      results.push({
        url: shopPath("*"),
        status: "warn",
        detail: "Aucune boutique listée : pages boutique non contrôlées",
      });
    }
    const alerts = alertLines(checks);

    const summary = {
      date: new Date().toISOString().split("T")[0],
      totalChecks: results.length,
      errors: results.filter((result) => result.status === "error").length,
      warnings: results.filter((result) => result.status === "warn").length,
      alerts,
      results: results.filter((result) => result.status !== "ok"),
    };

    if (alerts.length > 0) {
      logger.error(`[seo-audit] ${alerts.length} ALERTS: ${alerts.join(" | ")}`, { summary });
    } else {
      logger.info(`[seo-audit] OK - ${results.length} checks, 0 alerts`, { summary });
    }

    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error, "cron/seo-audit");
  }
}
