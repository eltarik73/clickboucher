// Checks of the daily seo-audit cron (src/app/api/cron/seo-audit/route.ts), one per thing chantier
// C1-SEO fixed: real 404s, noindex where it belongs, no shop entity, rating, review or Event on a
// list page, no rating beyond the verified reviews on a shop page, no shop page in the sitemap, no
// forbidden claim (src/lib/seo/claims.ts) in Klik&Go's own copy. Pure: what the cron fetched in,
// problems out, as French sentences for the owner's alert. No I/O, no clock. The page reading
// (robots directives, title, canonical, JSON-LD, own copy) is src/lib/seo/audit-html.ts.

import {
  canonicalOf,
  decodeEntities,
  jsonLdNodes,
  ownCopyText,
  readJsonLd,
  robotsVerdict,
  titleOf,
  typesOf,
  type JsonNode,
} from "@/lib/seo/audit-html";
import { findForbiddenClaims } from "@/lib/seo/claims";
import { absoluteUrl } from "@/lib/seo/site";
import { isSubmittableToEngines } from "@/lib/seo/submission-policy";

export { extractJsonLd, robotsVerdict } from "@/lib/seo/audit-html";

/** What the cron got for one path: status 0 and html null when the page did not answer. */
export type PageSnapshot = {
  path: string;
  status: number;
  html: string | null;
  xRobotsTag: string | null;
  /** Location header as sent (absolute or relative), null without one. */
  location: string | null;
};

/**
 * One audited path: its problems, each one an alert, and its warnings, reported without an alert.
 * Neither means the check passed.
 */
export type PageCheck = { path: string; problems: string[]; warnings?: string[] };

const SHOP_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "Store",
  "LocalBusiness",
  "FoodEstablishment",
]);
// schema.org Event and its subtypes (FoodEvent, SocialEvent…), EventSeries and Festival.
const EVENT_TYPE = /(?:Event|EventSeries|Festival)$/;
const MIN_SITEMAP_URLS = 100;
const MIN_TITLE_LENGTH = 10;
const LISTED_SAMPLES = 5;
const ALERT_PATHS_SHOWN = 10;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function sample(values: string[], max: number): string {
  const shown = values.slice(0, max).join(", ");
  return values.length > max ? `${shown} … (+${values.length - max})` : shown;
}

function statusProblem(snapshot: PageSnapshot, expected: number): string | null {
  if (snapshot.status === 0) return "injoignable (délai dépassé ou erreur réseau)";
  if (snapshot.status !== expected) return `statut HTTP ${snapshot.status} (attendu ${expected})`;
  return null;
}

/** A page that must answer 200: its status problem, else what `check` finds in its body. */
export function bodyProblems(snapshot: PageSnapshot, check: (body: string) => string[]): string[] {
  const status = statusProblem(snapshot, 200);
  if (status !== null) return [status];
  if (snapshot.html === null) return ["réponse sans corps"];
  return unique(check(snapshot.html));
}

// The canonical must be the page's own URL (« https://klikandgo.app » and « …app/ » are the same
// URL). The wording names the wrong host or path, not the page, so that one template bug gives
// one alert line listing its pages.
function canonicalProblem(canonical: string | null, path: string): string | null {
  if (canonical === null) return "canonical absent";
  if (!URL.canParse(canonical)) return "canonical illisible";
  const found = new URL(canonical);
  const expected = new URL(absoluteUrl(path));
  if (found.origin !== expected.origin) return `canonical sur un autre domaine (${found.origin})`;
  if (found.href !== expected.href) {
    return `canonical vers une autre URL (${found.pathname}${found.search})`;
  }
  return null;
}

function headProblems(html: string, snapshot: PageSnapshot): string[] {
  const problems: string[] = [];
  const robots = robotsVerdict(html, snapshot.xRobotsTag);
  if (robots.noindex) problems.push(`noindex (${unique(robots.directives).join(", ")})`);
  const title = titleOf(html);
  if (title.length < MIN_TITLE_LENGTH) problems.push("titre absent ou trop court");
  if (/\bhalal\s+halal\b/i.test(title)) problems.push("titre avec « halal halal »");
  const canonical = canonicalProblem(canonicalOf(html), snapshot.path);
  if (canonical !== null) problems.push(canonical);
  return problems;
}

/** A page that must be indexed as itself: 200, no noindex, a title, its own canonical. */
export function indexablePageProblems(snapshot: PageSnapshot): string[] {
  return bodyProblems(snapshot, (html) => headProblems(html, snapshot));
}

function claimProblems(text: string): string[] {
  return findForbiddenClaims(text).map(
    ({ id, match }) => `affirmation interdite (${id}) : « ${match.trim()} »`
  );
}

/**
 * A public list page (city, department, partner, occasion): indexable as itself, its JSON-LD
 * describes the page only (no shop entity, Product, rating, review or Event), and its own copy
 * makes no forbidden claim.
 */
export function listPageProblems(snapshot: PageSnapshot): string[] {
  return bodyProblems(snapshot, (html) => {
    const { values, invalid } = readJsonLd(html);
    const nodes = jsonLdNodes(values);
    const types = unique(nodes.flatMap(typesOf));
    const problems = headProblems(html, snapshot);
    if (invalid > 0) problems.push(`${invalid} bloc(s) JSON-LD illisible(s)`);
    const shopTypes = types.filter((type) => SHOP_ENTITY_TYPES.has(type));
    if (shopTypes.length > 0) {
      problems.push(`entité boutique dans le JSON-LD (${shopTypes.join(", ")})`);
    }
    if (types.includes("Product")) problems.push("entité Product dans le JSON-LD");
    if (nodes.some((node) => "aggregateRating" in node) || types.includes("AggregateRating")) {
      problems.push("aggregateRating dans le JSON-LD");
    }
    if (nodes.some((node) => "review" in node || "reviews" in node) || types.includes("Review")) {
      problems.push("review dans le JSON-LD");
    }
    const events = types.filter((type) => EVENT_TYPE.test(type));
    if (events.length > 0) problems.push(`entité Event dans le JSON-LD (${events.join(", ")})`);
    return [...problems, ...claimProblems(ownCopyText(html, values))];
  });
}

function reviewCountOf(rating: unknown): number | null {
  if (rating === null || typeof rating !== "object") return null;
  const count = Number((rating as JsonNode).reviewCount ?? (rating as JsonNode).ratingCount);
  return Number.isFinite(count) ? count : null;
}

// Rating problems of one JSON-LD object of a shop page.
function ratingProblems(node: JsonNode, verifiedCount: number): string[] {
  const types = typesOf(node);
  const isShop = types.some((type) => SHOP_ENTITY_TYPES.has(type));
  const reviews = node.review ?? node.reviews;
  const published: [string, unknown][] = [
    ["aggregateRating", node.aggregateRating],
    ["review", reviews],
  ];
  const problems: string[] = [];
  for (const [property, value] of published) {
    if (value === undefined) continue;
    if (!isShop) problems.push(`${types.join("/") || "entité sans type"} porte ${property}`);
    else if (verifiedCount === 0) problems.push(`${property} publié sans avis vérifié`);
  }
  if (!isShop || verifiedCount === 0) return problems;
  if (node.aggregateRating !== undefined) {
    const count = reviewCountOf(node.aggregateRating);
    if (count !== verifiedCount) {
      problems.push(`reviewCount ${count ?? "absent"} au lieu de ${verifiedCount} avis vérifiés`);
    }
  }
  const reviewCount = Array.isArray(reviews) ? reviews.length : reviews === undefined ? 0 : 1;
  if (reviewCount > verifiedCount) {
    problems.push(`${reviewCount} avis publiés pour ${verifiedCount} vérifiés`);
  }
  return problems;
}

/**
 * A shop page (/boutique/[slug]) against the number of verified reviews of that shop
 * (loadVerifiedShopRating): a rating only on the shop entity, only with verified reviews, with
 * their exact count; never a rating or review on a Product or any other entity.
 */
export function shopPageProblems(snapshot: PageSnapshot, verifiedCount: number): string[] {
  return bodyProblems(snapshot, (html) => {
    const { values, invalid } = readJsonLd(html);
    const problems = invalid > 0 ? [`${invalid} bloc(s) JSON-LD illisible(s)`] : [];
    return [
      ...problems,
      ...jsonLdNodes(values).flatMap((node) => ratingProblems(node, verifiedCount)),
    ];
  });
}

/**
 * The sitemap XML: at least 100 URLs, every expected city page, no shop page and no URL the
 * submission policy refuses (src/lib/seo/submission-policy.ts).
 */
export function sitemapProblems(xml: string, expectedCityPaths: string[]): string[] {
  const locs = [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/gi)].map((match) =>
    decodeEntities(match[1])
  );
  const paths = new Set<string>();
  const shopPaths: string[] = [];
  const refused: string[] = [];
  for (const loc of locs) {
    const path = URL.canParse(loc) ? new URL(loc).pathname : null;
    if (path !== null) paths.add(path);
    if (path !== null && /^\/boutique(?:\/|$)/i.test(path)) shopPaths.push(path);
    else if (!isSubmittableToEngines(loc)) refused.push(loc);
  }
  const missing = expectedCityPaths.filter((path) => !paths.has(path));
  const problems: string[] = [];
  if (locs.length < MIN_SITEMAP_URLS) {
    problems.push(`seulement ${locs.length} URL (au moins ${MIN_SITEMAP_URLS} attendues)`);
  }
  if (shopPaths.length > 0) {
    const listed = sample(shopPaths, LISTED_SAMPLES);
    problems.push(`${shopPaths.length} page(s) /boutique/ dans le sitemap : ${listed}`);
  }
  if (refused.length > 0) {
    const listed = sample(refused, LISTED_SAMPLES);
    problems.push(`${refused.length} URL refusée(s) par la politique de soumission : ${listed}`);
  }
  if (missing.length > 0) {
    problems.push(
      `${missing.length} page(s) ville absente(s) : ${sample(missing, LISTED_SAMPLES)}`
    );
  }
  return problems;
}

/** robots.txt answers 200 and names the sitemap. */
export function robotsTxtProblems(snapshot: PageSnapshot): string[] {
  return bodyProblems(snapshot, (text) =>
    /^\s*sitemap\s*:\s*\S+/im.test(text) ? [] : ["pas de ligne Sitemap"]
  );
}

/** The origin a redirect (3xx) leads to when it leaves the site; null otherwise. */
export function offSiteRedirectOrigin(snapshot: PageSnapshot): string | null {
  if (snapshot.status < 300 || snapshot.status > 399 || snapshot.location === null) return null;
  const pageUrl = absoluteUrl(snapshot.path);
  if (!URL.canParse(snapshot.location, pageUrl)) return null;
  const target = new URL(snapshot.location, pageUrl).origin;
  return target === new URL(pageUrl).origin ? null : target;
}

/**
 * A page that must not be indexed (sign-in, sign-up): a 200 must carry noindex, else an alert. A
 * redirect off the site has no content to index (Clerk's handshake, a 307 to *.clerk.accounts.dev
 * when production runs development keys): a warning, not an alert. Any other answer is an alert.
 */
export function mustBeNoindexCheck(snapshot: PageSnapshot): PageCheck {
  const offSite = offSiteRedirectOrigin(snapshot);
  if (offSite !== null) {
    return {
      path: snapshot.path,
      problems: [],
      warnings: [`redirection ${snapshot.status} hors du site (${offSite}) : rien à indexer`],
    };
  }
  return {
    path: snapshot.path,
    problems: bodyProblems(snapshot, (html) =>
      robotsVerdict(html, snapshot.xRobotsTag).noindex
        ? []
        : ["indexable : aucune directive noindex"]
    ),
  };
}

/** An unknown slug must answer a real 404: a 200 is a soft 404, a redirect hides the error. */
export function mustBeNotFoundProblems(snapshot: PageSnapshot): string[] {
  const status = statusProblem(snapshot, 404);
  if (status === null) return [];
  return snapshot.status === 200 ? ["statut HTTP 200 au lieu de 404 (soft 404)"] : [status];
}

/** One alert line per distinct problem, with the paths it was found on. */
export function alertLines(checks: PageCheck[]): string[] {
  const pathsByProblem = new Map<string, string[]>();
  for (const { path, problems } of checks) {
    for (const problem of problems) {
      pathsByProblem.set(problem, [...(pathsByProblem.get(problem) ?? []), path]);
    }
  }
  return [...pathsByProblem].map(
    ([problem, paths]) => `${problem} — ${sample(paths, ALERT_PATHS_SHOWN)}`
  );
}
