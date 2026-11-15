// The URL lists handed to IndexNow (src/lib/indexnow.ts). IndexNow is for pages added or changed:
// unchanged pages are not resubmitted (IndexNow FAQ), discovery stays the sitemap's job.
// - The daily cron (/api/cron/indexnow-fresh, 03:11 UTC) sends the sitemap entries whose lastmod
//   falls in the previous UTC day, [its midnight, the next midnight). Consecutive runs cover
//   consecutive days: a change is sent by exactly one run, the one of the day after it, and no
//   state is stored between runs. A content date (ISO day) is therefore sent the day after it:
//   it must be the day of the production deployment (src/lib/seo/sitemap-entries.ts).
//   /bons-plans, dated by any product write, is never sent (isDatedByProductUpdates).
// - The admin validation of a shop sends the home page and the city pages of that shop's city:
//   the pages its listing changes. Never the shop page (submission policy).

import { seoCitySlugsForShopCity } from "@/lib/seo/city-match";
import { HOME_PATH, cityPath } from "@/lib/seo/routes";
import {
  entriesChangedSince,
  isDatedByProductUpdates,
  type SitemapEntry,
  type SitemapFamily,
} from "@/lib/seo/sitemap-entries";
import { absoluteUrl } from "@/lib/seo/site";
import { isSubmittableToEngines } from "@/lib/seo/submission-policy";

/** The UTC day before the one of `now`: from its midnight (included) to the next (excluded). */
export function previousUtcDay(now: Date): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  return {
    start: new Date(Date.UTC(year, month, day - 1)),
    end: new Date(Date.UTC(year, month, day)),
  };
}

/** Submittable entries changed during the previous UTC day, /bons-plans excepted. */
function freshEntries(entries: SitemapEntry[], now: Date): SitemapEntry[] {
  const { start, end } = previousUtcDay(now);
  return entriesChangedSince(entries, start).filter(
    (entry) =>
      entry.lastModified.getTime() < end.getTime() &&
      isSubmittableToEngines(entry.path) &&
      !isDatedByProductUpdates(entry.path)
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
