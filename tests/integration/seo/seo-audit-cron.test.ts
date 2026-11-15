// @vitest-environment node
// The seo-audit cron on real PostgreSQL (C1-SEO, FIX-13): it reads the site with GET requests only
// (global fetch replaced by a fake site, nothing leaves the process), checks every city page, the
// auth pages, two unknown slugs and the three newest listed shops against their verified reviews,
// and turns every problem into an alert logged with logger.error.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("CRON_SECRET", "itest-seo-audit-secret");
});

import { NextRequest } from "next/server";
import type { Shop } from "@prisma/client";
import { GET } from "@/app/api/cron/seo-audit/route";
import { logger } from "@/lib/logger";
import { SEO_CITIES } from "@/lib/seo/cities";
import { STATIC_PUBLIC_PATHS, cityPath, partnerPath, shopPath } from "@/lib/seo/routes";
import { SITE_URL, absoluteUrl } from "@/lib/seo/site";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

type FakePage = { status: number; body: string };

const CITY_PATHS = SEO_CITIES.map((city) => cityPath(city.slug));
const LIST_PATHS = [
  ...CITY_PATHS,
  "/devenir-boucher-partenaire/chambery",
  "/boucheries-halal/savoie",
  "/occasions/aid-al-adha/chambery",
];
const ABSENT_PATHS = ["/boutique/__audit-absent__", "/boucherie-halal/__audit-absent__"];

let site: Map<string, FakePage>;
const requests: { url: string; method: string }[] = [];

function htmlPage(path: string, robots: string, jsonLd: unknown[] = []): string {
  const scripts = jsonLd
    .map((data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`)
    .join("");
  return `<!DOCTYPE html><html lang="fr"><head><title>Page de test | Klik&amp;Go</title><meta name="robots" content="${robots}"/><link rel="canonical" href="${absoluteUrl(path)}"/></head><body>${scripts}<main><h1>Boucherie halal</h1></main></body></html>`;
}

/** A site where every check passes. */
function healthySite(): Map<string, FakePage> {
  const sitemapPaths = [
    ...STATIC_PUBLIC_PATHS,
    ...CITY_PATHS,
    ...SEO_CITIES.map((c) => partnerPath(c.slug)),
  ];
  const locs = sitemapPaths.map((path) => `<url><loc>${absoluteUrl(path)}</loc></url>`).join("");
  const pages = new Map<string, FakePage>([
    ["/sitemap.xml", { status: 200, body: `<urlset>${locs}</urlset>` }],
    [
      "/robots.txt",
      { status: 200, body: `User-Agent: *\nSitemap: ${absoluteUrl("/sitemap.xml")}\n` },
    ],
    ["/", { status: 200, body: htmlPage("/", "index, follow") }],
    ["/sign-in", { status: 200, body: htmlPage("/sign-in", "noindex, nofollow") }],
    ["/sign-up", { status: 200, body: htmlPage("/sign-up", "noindex, nofollow") }],
  ]);
  for (const path of LIST_PATHS)
    pages.set(path, { status: 200, body: htmlPage(path, "index, follow") });
  return pages;
}

function shopPage(shop: Shop, reviewCount: number | null): FakePage {
  const store = {
    "@context": "https://schema.org",
    "@type": ["Store", "FoodEstablishment", "LocalBusiness"],
    name: shop.name,
    ...(reviewCount !== null && {
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.7, reviewCount },
    }),
  };
  return { status: 200, body: htmlPage(shopPath(shop.slug), "index, follow", [store]) };
}

async function runCron(withSecret = true) {
  const headers: Record<string, string> = withSecret
    ? { authorization: "Bearer itest-seo-audit-secret" }
    : {};
  const response = await GET(new NextRequest("http://localhost/api/cron/seo-audit", { headers }));
  return {
    status: response.status,
    data: (await response.json()).data as {
      alerts: string[];
      errors: number;
      warnings: number;
      totalChecks: number;
    },
  };
}

function requestedPaths(): string[] {
  return requests.map((request) => request.url.slice(SITE_URL.length)).sort();
}

beforeEach(() => {
  site = healthySite();
  requests.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, method: init?.method ?? "GET" });
      if (!url.startsWith(`${SITE_URL}/`)) throw new Error(`unexpected request to ${url}`);
      const page = site.get(url.slice(SITE_URL.length)) ?? { status: 404, body: "Introuvable" };
      return new Response(page.body, { status: page.status });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/cron/seo-audit", () => {
  it("answers 401 without the cron secret and requests nothing", async () => {
    expect((await runCron(false)).status).toBe(401);
    expect(requests).toEqual([]);
  });

  it("raises no alert on a healthy site, reading it with GET requests only", async () => {
    const error = vi.spyOn(logger, "error");

    const { status, data } = await runCron();

    expect(status).toBe(200);
    expect(data.alerts).toEqual([]);
    expect(data).toMatchObject({ errors: 0, warnings: 1 });
    expect(error).not.toHaveBeenCalled();
    expect(requests.every((request) => request.method === "GET")).toBe(true);
    const expected = ["/sitemap.xml", "/robots.txt", "/", "/sign-in", "/sign-up"];
    expect(requestedPaths()).toEqual([...expected, ...ABSENT_PATHS, ...LIST_PATHS].sort());
  });

  it("checks the three newest listed shops against their verified reviews", async () => {
    const at = (day: number) => new Date(Date.UTC(2031, 0, day));
    const oldest = await createTestShop({ visible: true, createdAt: at(1) });
    const bare = await createTestShop({
      visible: true,
      createdAt: at(2),
      rating: 4.7,
      ratingCount: 89,
    });
    const seeded = await createTestShop({
      visible: true,
      createdAt: at(3),
      rating: 4.7,
      ratingCount: 89,
    });
    const reviewed = await createTestShop({ visible: true, createdAt: at(4) });
    const suspended = await createTestShop({ visible: true, createdAt: at(5), suspendedAt: at(5) });
    const unlisted = await createTestShop({ visible: false, createdAt: at(6) });
    for (const rating of [5, 4]) {
      const user = await createTestUser();
      const order = await createTestOrder({
        shopId: reviewed.id,
        userId: user.id,
        status: "PICKED_UP",
      });
      await prisma.review.create({
        data: { shopId: reviewed.id, userId: user.id, orderId: order.id, rating, comment: "Bien." },
      });
    }
    await prisma.review.create({
      data: { shopId: seeded.id, userId: (await createTestUser()).id, rating: 5, comment: "Seed" },
    });
    site.set(shopPath(bare.slug), shopPage(bare, null));
    site.set(shopPath(seeded.slug), shopPage(seeded, 89));
    site.set(shopPath(reviewed.slug), shopPage(reviewed, 2));
    const error = vi.spyOn(logger, "error");

    const { data } = await runCron();

    const shopPaths = requestedPaths().filter(
      (path) => path.startsWith("/boutique/") && !ABSENT_PATHS.includes(path)
    );
    expect(shopPaths).toEqual([bare, seeded, reviewed].map((shop) => shopPath(shop.slug)).sort());
    for (const skipped of [oldest, suspended, unlisted]) {
      expect(shopPaths).not.toContain(shopPath(skipped.slug));
    }
    expect(data.alerts).toEqual([
      `aggregateRating publié sans avis vérifié — ${shopPath(seeded.slug)}`,
    ]);
    expect(data.warnings).toBe(0);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain(shopPath(seeded.slug));
  });

  it("alerts on a soft 404, an indexable sign-in page, a shop in the sitemap and a dead city page", async () => {
    site.set("/boutique/__audit-absent__", { status: 200, body: htmlPage("/", "noindex") });
    site.set("/sign-in", { status: 200, body: htmlPage("/sign-in", "index, follow") });
    const sitemap = site.get("/sitemap.xml")?.body ?? "";
    const shopLoc = `<url><loc>${absoluteUrl("/boutique/el-mektoub")}</loc></url>`;
    site.set("/sitemap.xml", {
      status: 200,
      body: sitemap.replace("</urlset>", `${shopLoc}</urlset>`),
    });
    site.delete(cityPath("chambery"));

    const { data } = await runCron();

    expect(data.alerts).toEqual([
      "1 page(s) /boutique/ dans le sitemap : /boutique/el-mektoub — /sitemap.xml",
      "indexable : aucune directive noindex — /sign-in",
      "statut HTTP 200 au lieu de 404 (soft 404) — /boutique/__audit-absent__",
      `statut HTTP 404 (attendu 200) — ${cityPath("chambery")}`,
    ]);
  });

  it("warns without an alert when /sign-in and /sign-up redirect to Clerk's handshake", async () => {
    // A cookie-less GET while production runs Clerk development keys: 307 to another host.
    const handshake = "https://example.clerk.accounts.dev/v1/client/handshake";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, method: init?.method ?? "GET" });
        const path = url.slice(SITE_URL.length);
        if (path === "/sign-in" || path === "/sign-up") {
          return new Response("", { status: 307, headers: { location: `${handshake}?p=${path}` } });
        }
        const page = site.get(path) ?? { status: 404, body: "Introuvable" };
        return new Response(page.body, { status: page.status });
      })
    );
    const error = vi.spyOn(logger, "error");

    const { data } = await runCron();

    expect(data.alerts).toEqual([]);
    expect(data).toMatchObject({ errors: 0, warnings: 3 });
    expect(error).not.toHaveBeenCalled();
  });

  it("reports a page that does not answer as unreachable", async () => {
    const healthyFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === absoluteUrl(cityPath("lyon"))) throw new TypeError("fetch failed");
        return healthyFetch(input, init);
      })
    );
    const warn = vi.spyOn(logger, "warn");

    const { data } = await runCron();

    expect(data.alerts).toEqual([
      `injoignable (délai dépassé ou erreur réseau) — ${cityPath("lyon")}`,
    ]);
    expect(warn).toHaveBeenCalledWith("[seo-audit] page unreachable", {
      path: cityPath("lyon"),
      cause: "TypeError: fetch failed",
    });
  });
});
