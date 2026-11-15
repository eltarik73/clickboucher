// The URL lists handed to IndexNow (src/lib/indexnow.ts). IndexNow is for pages added or changed:
// unchanged pages are not resubmitted (IndexNow FAQ), discovery stays the sitemap's job.
// - The daily cron (/api/cron/indexnow-fresh, 03:11 UTC) sends the sitemap entries whose lastmod
//   is between the start of the previous UTC day and now. The window starts a full day before the
//   current one, so a page changed just after a run is still sent by the next one; no state is
//   stored between runs.
// - The admin validation of a shop sends the home page and the city pages of that shop's city:
//   the pages its listing changes. Never the shop page (submission policy).

import { seoCitySlugsForShopCity } from "@/lib/seo/city-match";
import { HOME_PATH, cityPath } from "@/lib/seo/routes";
import {
  entriesChangedSince,
  type SitemapEntry,
  type SitemapFamily,
} from "@/lib/seo/sitemap-entries";
import { absoluteUrl } from "@/lib/seo/site";
import { isSubmittableToEngines } from "@/lib/seo/submission-policy";

/** Midnight UTC of the day before `now`. */
export function previousUtcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
}

/** Submittable entries changed since the start of the previous UTC day, and not after `now`. */
function freshEntries(entries: SitemapEntry[], now: Date): SitemapEntry[] {
  return entriesChangedSince(entries, previousUtcDayStart(now)).filter(
    (entry) => entry.lastModified.getTime() <= now.getTime() && isSubmittableToEngines(entry.path)
  );
}

function absoluteUrls(paths: string[]): string[] {
  return Array.from(new Set(paths.map((path) => absoluteUrl(path))));
}

/** Absolute URLs of the pages the daily IndexNow run sends. Empty when nothing changed. */
export function freshIndexNowUrls(entries: SitemapEntry[], now: Date): string[] {
  return absoluteUrls(freshEntries(entries, now).map((entry) => entry.path));
}

/** Number of pages per family in the daily run, for its log and response. */
export function countFreshByFamily(
  entries: SitemapEntry[],
  now: Date
): Partial<Record<SitemapFamily, number>> {
  const counts: Partial<Record<SitemapFamily, number>> = {};
  for (const { family } of freshEntries(entries, now)) counts[family] = (counts[family] ?? 0) + 1;
  return counts;
}

/** Absolute URLs sent when a shop is validated: the home page and its city pages. */
export function validationIndexNowUrls(shopCity: string | null): string[] {
  const paths = [HOME_PATH, ...seoCitySlugsForShopCity(shopCity).map((slug) => cityPath(slug))];
  return absoluteUrls(paths.filter((path) => isSubmittableToEngines(path)));
}
