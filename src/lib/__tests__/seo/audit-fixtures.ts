// Pages for the seo-audit check tests (audit-checks.test.ts, audit-checks-shop-sitemap.test.ts),
// rendered the way Next.js serves them: robots metas, title, description and canonical in the
// head, the root layout's Organization and WebSite JSON-LD, then the page. The city page is built
// from the real city content (src/lib/seo/content/city.ts), so a claim slipped into that content
// fails the « clean city page » test too.
import type { PageSnapshot } from "@/lib/seo/audit-checks";
import { SEO_CITIES, type SeoCity } from "@/lib/seo/cities";
import { cityPageContent } from "@/lib/seo/content/city";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo/jsonld/organization";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import { cityPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { cityTitle } from "@/lib/seo/titles";

function city(slug: string): SeoCity {
  const found = SEO_CITIES.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw new Error(`no SEO city ${slug}`);
  return found;
}

export const CHAMBERY = city("chambery");
export const CHAMBERY_PATH = cityPath(CHAMBERY.slug);

export const INDEX_METAS =
  '<meta name="robots" content="index, follow"/><meta name="googlebot" content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1"/>';

// What production served for /boutique/<unknown> on 2026-11-15: a 200 whose head says
// « index, follow » and then « noindex » twice (scratchpad/seo-audit/crawl/boutique-404.json).
export const SOFT_404 = `<!DOCTYPE html><html lang="fr"><head>${INDEX_METAS}<title>Klik&amp;Go — Click &amp; Collect Boucherie Halal</title><meta name="robots" content="noindex"/><meta name="robots" content="noindex"/></head><body><main><!--$!--><template data-dgst="NEXT_NOT_FOUND"></template><div class="animate-pulse"></div></main></body></html>`;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function ld(data: unknown): string {
  return `<script type="application/ld+json">${serializeJsonLd(data)}</script>`;
}

/** A page as Next.js renders it, canonical on `path`. */
export function html(input: {
  path: string;
  title: string;
  jsonLd?: unknown[];
  body?: string;
  head?: string;
}): string {
  return [
    '<!DOCTYPE html><html lang="fr"><head><meta charSet="utf-8"/>',
    `<title>${escapeHtml(input.title)} | Klik&amp;Go</title>`,
    `<meta name="description" content="${escapeHtml(CHAMBERY.description)}"/>`,
    INDEX_METAS,
    `<link rel="canonical" href="${absoluteUrl(input.path)}"/>`,
    input.head ?? "",
    "</head><body>",
    ...[buildOrganizationJsonLd(), buildWebSiteJsonLd(), ...(input.jsonLd ?? [])].map(ld),
    `<main>${input.body ?? ""}</main></body></html>`,
  ].join("");
}

/** The Chambéry city page with one listed shop: hero, local context, FAQ and JSON-LD. */
export function cityPage(extra: { jsonLd?: unknown[]; body?: string; head?: string } = {}): string {
  const content = cityPageContent(CHAMBERY, 1);
  const faq = content.faqs
    .map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`)
    .join("");
  const hero = `<h1>Boucherie halal à ${CHAMBERY.name}</h1><p>${escapeHtml(CHAMBERY.localContext)}</p>`;
  return html({
    path: CHAMBERY_PATH,
    title: cityTitle(CHAMBERY),
    jsonLd: [...content.jsonLd, ...(extra.jsonLd ?? [])],
    head: extra.head,
    body: `${hero}${faq}${extra.body ?? ""}`,
  });
}

export function snap(
  path: string,
  body: string | null,
  status = 200,
  xRobotsTag: string | null = null,
  location: string | null = null
): PageSnapshot {
  return { path, status, html: body, xRobotsTag, location };
}
