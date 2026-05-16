// src/app/api/cron/seo-audit/route.ts
//
// Audit SEO automatique quotidien — alerte si régression critique.
// Tourne sur Vercel (24/7, Mac peut être éteint).
//
// Schedule : 10:11 UTC daily (cf vercel.json)
// Auth : Vercel Cron envoie Authorization: Bearer ${CRON_SECRET}
//
// Vérifications :
//   1. Sitemap.xml accessible + URL count cohérent
//   2. Robots.txt accessible
//   3. SEO_CITIES pages : robots meta = "index, follow" (pas de noindex auto)
//   4. Homepage : title + canonical présents
//   5. Devenir-boucher-partenaire pages : robots meta correct
//
// Alerte Sentry si :
//   - sitemap < 100 URLs (régression majeure)
//   - 1+ page critique en noindex (la fameuse erreur 2026-05-09)
//   - title manquant ou canonical absent
//
// Lecon ajoutée au skill seo-anti-penalty 2026-05-15

import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { SEO_CITIES } from "@/lib/seo/cities";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

type CheckResult = {
  url: string;
  status: "ok" | "warn" | "error";
  detail: string;
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KlikGoSeoAudit/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractRobotsMeta(html: string): string | null {
  const match = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function hasNoindex(html: string): boolean {
  const robots = extractRobotsMeta(html);
  return robots ? /noindex/i.test(robots) : false;
}

function hasTitle(html: string): boolean {
  return /<title>[^<]{10,}<\/title>/i.test(html);
}

function hasCanonical(html: string): boolean {
  return /<link\s+rel=["']canonical["']/i.test(html);
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const results: CheckResult[] = [];
    const alerts: string[] = [];

    // 1. Sitemap
    const sitemapXml = await fetchHtml(`${SITE_URL}/sitemap.xml`);
    if (!sitemapXml) {
      results.push({ url: "/sitemap.xml", status: "error", detail: "Sitemap inaccessible" });
      alerts.push("Sitemap inaccessible");
    } else {
      const locCount = (sitemapXml.match(/<loc>/g) ?? []).length;
      if (locCount < 100) {
        results.push({
          url: "/sitemap.xml",
          status: "error",
          detail: `Only ${locCount} URLs (expected ≥100)`,
        });
        alerts.push(`Sitemap dropped to ${locCount} URLs`);
      } else {
        results.push({ url: "/sitemap.xml", status: "ok", detail: `${locCount} URLs` });
      }
    }

    // 2. Robots.txt
    const robotsTxt = await fetchHtml(`${SITE_URL}/robots.txt`);
    if (!robotsTxt) {
      results.push({ url: "/robots.txt", status: "error", detail: "Robots inaccessible" });
      alerts.push("Robots.txt inaccessible");
    } else if (!robotsTxt.includes("Sitemap:")) {
      results.push({ url: "/robots.txt", status: "warn", detail: "No Sitemap directive" });
    } else {
      results.push({ url: "/robots.txt", status: "ok", detail: "Has sitemap directive" });
    }

    // 3. Homepage
    const home = await fetchHtml(`${SITE_URL}/`);
    if (home) {
      if (hasNoindex(home)) alerts.push("Homepage NOINDEX !!!");
      if (!hasTitle(home)) alerts.push("Homepage missing <title>");
      if (!hasCanonical(home)) alerts.push("Homepage missing canonical");
      results.push({
        url: "/",
        status: hasNoindex(home) || !hasTitle(home) || !hasCanonical(home) ? "error" : "ok",
        detail: `robots=${extractRobotsMeta(home) ?? "missing"}, title=${hasTitle(home)}, canonical=${hasCanonical(home)}`,
      });
    } else {
      results.push({ url: "/", status: "error", detail: "Homepage 5xx/timeout" });
      alerts.push("Homepage unreachable");
    }

    // 4. SEO_CITIES pages — critical anti-noindex check
    // (la fameuse régression 2026-05-09 qui a sorti 5/6 villes de l'index)
    const citiesToCheck = SEO_CITIES.slice(0, 10); // First 10 = high priority
    const cityChecks = await Promise.all(
      citiesToCheck.map(async (city) => {
        const html = await fetchHtml(`${SITE_URL}/boucherie-halal/${city.slug}`);
        if (!html) return { city: city.slug, status: "error" as const, robots: "fetch_failed" };
        const robots = extractRobotsMeta(html) ?? "missing";
        const noindex = hasNoindex(html);
        return { city: city.slug, status: noindex ? ("error" as const) : ("ok" as const), robots };
      })
    );

    const cityNoindexCount = cityChecks.filter(
      (c) => c.status === "error" && c.robots.includes("noindex")
    ).length;
    if (cityNoindexCount > 0) {
      alerts.push(
        `${cityNoindexCount} SEO_CITIES en NOINDEX ! ${cityChecks
          .filter((c) => c.status === "error")
          .map((c) => c.city)
          .join(", ")}`
      );
    }

    cityChecks.forEach((c) => {
      results.push({
        url: `/boucherie-halal/${c.city}`,
        status: c.status,
        detail: `robots=${c.robots}`,
      });
    });

    // 5. Devenir-boucher-partenaire (B2B pages, business-critical)
    const partnerCheck = await fetchHtml(`${SITE_URL}/devenir-boucher-partenaire/chambery`);
    if (partnerCheck && hasNoindex(partnerCheck)) {
      alerts.push("Devenir-boucher Chambéry en NOINDEX !");
      results.push({
        url: "/devenir-boucher-partenaire/chambery",
        status: "error",
        detail: "noindex",
      });
    } else if (partnerCheck) {
      results.push({
        url: "/devenir-boucher-partenaire/chambery",
        status: "ok",
        detail: "index, follow",
      });
    }

    const summary = {
      date: new Date().toISOString().split("T")[0],
      totalChecks: results.length,
      errors: results.filter((r) => r.status === "error").length,
      warnings: results.filter((r) => r.status === "warn").length,
      alerts,
      results: results.filter((r) => r.status !== "ok"), // Only show problematic
    };

    if (alerts.length > 0) {
      // Sentry-tracked via logger.error
      logger.error(`[seo-audit] ${alerts.length} ALERTS: ${alerts.join(" | ")}`, { summary });
    } else {
      logger.info(`[seo-audit] OK - ${results.length} checks, 0 alerts`, { summary });
    }

    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error, "cron/seo-audit");
  }
}
