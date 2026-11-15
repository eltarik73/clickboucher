// Canonical origin of the public site and the absolute URLs built from it. Every canonical,
// sitemap entry, breadcrumb and JSON-LD URL goes through absoluteUrl so a single variable
// (NEXT_PUBLIC_SITE_URL, baked at build time) decides the host.

export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app"
).replace(/\/+$/, "");

/** @id of the Organization entity emitted by the root layout. */
export const ORGANIZATION_ID = `${SITE_URL}#organization`;
/** @id of the WebSite entity emitted by the root layout. */
export const WEBSITE_ID = `${SITE_URL}#website`;

/**
 * Absolute URL of a site path. The path must start with « / »; « / » itself gives SITE_URL
 * (no trailing slash, as in the sitemap and the canonicals).
 */
export function absoluteUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new TypeError(`absoluteUrl expects a site path starting with "/", got "${path}"`);
  }
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}
