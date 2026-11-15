// /sitemap.xml. The URL set and each lastmod are decided by src/lib/seo/sitemap-entries.ts (no
// shop page, every city and partner page, honest per-page dates); this file only loads the data
// and renders absolute URLs.
//
// ISR 1 h: the handler reads no request, there is no point regenerating it for every crawler.
// Deliberately WITHOUT try/catch: a database error must fail the regeneration so that ISR keeps
// serving the last valid sitemap (never a sitemap cut down to the pages that need no data).
export const revalidate = 3600;

import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/lib/seo/sitemap-entries";
import { loadSitemapData } from "@/lib/seo/sitemap-data";
import { absoluteUrl } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = buildSitemapEntries(await loadSitemapData());
  return entries.map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
