// What may ever be submitted to a search engine. Every sender goes through this one rule: the
// sitemap builder (src/lib/seo/sitemap-entries.ts), the IndexNow URL lists of the daily cron and of
// the admin shop validation (src/lib/seo/indexnow-urls.ts), and the IndexNow transport itself
// (src/lib/indexnow.ts), so even the manual admin endpoint cannot push a refused URL.
//
// Refused: shop pages (/boutique/…: the listed shops are not verified partners, owner decision
// pending), API routes, the private and transactional areas (the robots.txt Disallow list and the
// noindex tool pages), and anything that is not the canonical URL of a page of this site (another
// host, a query string, a fragment, a trailing slash, a file such as /sitemap.xml).

import { SITE_URL } from "@/lib/seo/site";

const SITE_ORIGIN = new URL(SITE_URL).origin;

// A root refuses itself and everything below it, segment by segment: "/boucher" refuses
// "/boucher/commandes" but not "/boucherie-halal/lyon".
const NEVER_SUBMITTED_ROOTS: readonly string[] = [
  "/boutique",
  "/api",
  "/admin",
  "/webmaster",
  "/dashboard",
  "/boucher",
  "/onboarding",
  "/checkout",
  "/panier",
  "/commandes",
  "/commande",
  "/suivi",
  "/validation",
  "/profil",
  "/avantages",
  "/recherche",
  "/sign-in",
  "/sign-up",
  "/shop",
];

// Last path segment with an extension: a file (sitemap.xml, robots.txt, llms.txt…), not a page.
const FILE_PATH = /\.[a-z0-9]+$/i;

/** The path of a page of this site given as a site path or an absolute URL; null otherwise. */
// No canonical page of the site has a percent-encoded path, and an encoded one could hide a
// refused root (« /%62outique/… » is « /boutique/… »), so any « % » is refused.
function sitePagePath(urlOrPath: string): string | null {
  if (urlOrPath.startsWith("/")) {
    if (urlOrPath.startsWith("//") || /[?#%]/.test(urlOrPath)) return null;
    return urlOrPath;
  }
  if (!URL.canParse(urlOrPath)) return null;
  const url = new URL(urlOrPath);
  if (url.origin !== SITE_ORIGIN || url.search !== "" || url.hash !== "") return null;
  if (url.pathname.includes("%")) return null;
  return url.pathname;
}

function isUnderRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

/** May this URL (absolute, on this site) or site path be sent to a search engine? */
export function isSubmittableToEngines(urlOrPath: string): boolean {
  const path = sitePagePath(urlOrPath)?.toLowerCase();
  if (path === undefined) return false;
  if (path !== "/" && path.endsWith("/")) return false;
  if (FILE_PATH.test(path)) return false;
  return !NEVER_SUBMITTED_ROOTS.some((root) => isUnderRoot(path, root));
}
