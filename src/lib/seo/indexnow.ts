/**
 * IndexNow protocol — instantly notify search engines (Bing, Yandex, Naver, Seznam, Yep)
 * when content is published or updated. Free, no auth besides a key file.
 *
 * Docs: https://www.indexnow.org/documentation
 */

const HOST = "klikandgo.app";
const KEY = "a050cf046d499f8cfdb8788054dcf15a";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const ENDPOINT = "https://api.indexnow.org/IndexNow";

export async function notifyIndexNow(urls: string[]): Promise<{ ok: boolean; status: number }> {
  if (!urls.length) return { ok: true, status: 200 };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList: urls,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export const INDEXNOW_KEY = KEY;
export const INDEXNOW_HOST = HOST;
