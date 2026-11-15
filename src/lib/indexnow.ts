// IndexNow transport: tells Bing, Yandex, Seznam, Naver… that pages of the site were added or
// changed (https://www.indexnow.org/documentation). Server-side only, and the last gate before an
// engine:
// - it sends nothing outside the production deployment (isProductionDeployment()): a local
//   production build, CI or a preview never pings, whatever NODE_ENV or NEXT_PUBLIC_SITE_URL say;
// - it drops every URL the submission policy refuses (src/lib/seo/submission-policy.ts: shop
//   pages, API routes, private areas, other hosts) and every relative URL.
//
// Callers: the daily cron /api/cron/indexnow-fresh and the admin shop validation, with the lists
// of src/lib/seo/indexnow-urls.ts; the admin endpoint POST /api/seo/indexnow, with explicit URLs.
// It never throws: a refused request or a network failure is logged as a warning.
//
// The key file is public/<KEY>.txt.

import { isProductionDeployment } from "@/lib/auth/test-mode-env";
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/seo/site";
import { isSubmittableToEngines } from "@/lib/seo/submission-policy";

const ENDPOINT = "https://api.indexnow.org/IndexNow";
const HOST = new URL(SITE_URL).host;
const KEY = "b358f6bef780cfa8abcef149668adb3e68c093e8b6e586fc1f9d4347455a64e2";
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;
// The validation route awaits the call: a stalled engine must not hold the admin's request.
const REQUEST_TIMEOUT_MS = 10_000;

export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (!isProductionDeployment()) return;

  // URL.canParse refuses relative URLs: IndexNow needs absolute ones, on our host (policy).
  const urlList = Array.from(
    new Set(urls.filter((url) => URL.canParse(url) && isSubmittableToEngines(url)))
  );
  if (urlList.length === 0) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) {
      logger.info(`[indexnow] notified ${urlList.length} URL(s)`);
    } else {
      logger.warn(`[indexnow] failed status=${res.status}`);
    }
  } catch (error) {
    logger.warn(`[indexnow] error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
