// @vitest-environment node
//
// The IndexNow transport is the last gate before a search engine: it sends nothing outside the
// production deployment (a local production build or CI must never ping), and it drops every URL
// the submission policy refuses. The network is never reached: fetch is a mock.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyIndexNow } from "@/lib/indexnow";
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/seo/site";

const CITY_URL = `${SITE_URL}/boucherie-halal/chambery`;
const SHOP_URL = `${SITE_URL}/boutique/el-mektoub`;

const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => new Response(null));

function sentBody(): { host: string; key: string; keyLocation: string; urlList: string[] } {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://api.indexnow.org/IndexNow");
  expect(init?.method).toBe("POST");
  return JSON.parse(String(init?.body));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("KLIKGO_DEPLOY_ENV", "local");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(null));
});

describe("outside the production deployment", () => {
  it("sends nothing, even when NODE_ENV is production (local production build, CI)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await notifyIndexNow([CITY_URL]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing from a preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("KLIKGO_DEPLOY_ENV", "preview");
    await notifyIndexNow([CITY_URL]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("in the production deployment", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("sends the city URL and drops the shop URL", async () => {
    await notifyIndexNow([CITY_URL, SHOP_URL]);
    expect(sentBody().urlList).toEqual([CITY_URL]);
  });

  it("also sends when only the build-time deployment marker says production", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("KLIKGO_DEPLOY_ENV", "production");
    await notifyIndexNow([CITY_URL]);
    expect(sentBody().urlList).toEqual([CITY_URL]);
  });

  it("drops API, private, foreign-host, relative and duplicate URLs, and keeps the key", async () => {
    await notifyIndexNow([
      CITY_URL,
      `${SITE_URL}/api/shops`,
      `${SITE_URL}/panier`,
      `${SITE_URL}/sitemap.xml`,
      "https://example.com/boucherie-halal/chambery",
      "/boucherie-halal/lyon",
      CITY_URL,
    ]);
    const body = sentBody();
    expect(body.urlList).toEqual([CITY_URL]);
    expect(body.host).toBe(new URL(SITE_URL).host);
    expect(body.key).toBe("b358f6bef780cfa8abcef149668adb3e68c093e8b6e586fc1f9d4347455a64e2");
    expect(body.keyLocation).toBe(`${SITE_URL}/${body.key}.txt`);
  });

  it("sends nothing when every URL is refused or the list is empty", async () => {
    await notifyIndexNow([SHOP_URL, `${SITE_URL}/api/shops`]);
    await notifyIndexNow([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs a warning and resolves when the engine refuses or the network fails", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 422 }));
    await expect(notifyIndexNow([CITY_URL])).resolves.toBeUndefined();
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(notifyIndexNow([CITY_URL])).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining("status=422"),
      expect.stringContaining("network down"),
    ]);
  });
});
