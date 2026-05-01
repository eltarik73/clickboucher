// IndexNow protocol — instant reindexation by Bing, Copilot, Yandex,
// DuckDuckGo, Naver. Microsoft also feeds ChatGPT Search via Bing's index,
// so this multiplies AI visibility (audit GEO 2026).
//
// Usage (server-side only):
//   import { notifyIndexNow } from "@/lib/indexnow";
//   await notifyIndexNow(["https://klikandgo.app/boutique/foo"]);
//
// Triggered automatically from:
//   - shop create/update API
//   - product publish
//   - recipe publish
//   - new offer / banner

import { logger } from "@/lib/logger";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";
const HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
const KEY = "b358f6bef780cfa8abcef149668adb3e68c093e8b6e586fc1f9d4347455a64e2";
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;

export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (urls.length === 0) return;

  // Filter: only same-host URLs are accepted by IndexNow
  const sameHostUrls = urls.filter((u) => {
    try {
      return new URL(u).host === HOST;
    } catch {
      return false;
    }
  });
  if (sameHostUrls.length === 0) return;

  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList: sameHostUrls,
      }),
    });
    if (res.ok || res.status === 202) {
      logger.info(`[indexnow] notified ${sameHostUrls.length} URL(s)`);
    } else {
      logger.warn(`[indexnow] failed status=${res.status}`);
    }
  } catch (error) {
    logger.warn(`[indexnow] error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
