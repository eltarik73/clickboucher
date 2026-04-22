// tests/lib/image-search.test.ts — Coverage for image-search helpers
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("image-search helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("searchPexels returns [] when PEXELS_API_KEY missing", async () => {
    delete process.env.PEXELS_API_KEY;
    const { searchPexels } = await import("@/lib/image-search");
    const result = await searchPexels("beef");
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("searchUnsplash returns [] when UNSPLASH_ACCESS_KEY missing", async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    const { searchUnsplash } = await import("@/lib/image-search");
    const result = await searchUnsplash("beef");
    expect(result).toEqual([]);
  });

  it("searchPexels wraps thumbnails through /api/boucher/images/proxy", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        photos: [
          {
            id: 123,
            width: 1000,
            height: 750,
            src: {
              original: "https://images.pexels.com/photos/123/original.jpeg",
              large2x: "https://images.pexels.com/photos/123/large2x.jpeg",
              large: "https://images.pexels.com/photos/123/large.jpeg",
              medium: "https://images.pexels.com/photos/123/medium.jpeg",
            },
            photographer: "Jane",
            photographer_url: "https://pexels.com/@jane",
          },
        ],
      }),
    });

    const { searchPexels } = await import("@/lib/image-search");
    const results = await searchPexels("beef");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("pexels-123");
    expect(results[0].source).toBe("pexels");
    expect(results[0].thumbUrl).toMatch(/^\/api\/boucher\/images\/proxy\?url=/);
    expect(decodeURIComponent(results[0].thumbUrl.split("url=")[1])).toBe(
      "https://images.pexels.com/photos/123/medium.jpeg"
    );
  });

  it("searchPexels returns [] on non-OK response", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
    });
    const { searchPexels } = await import("@/lib/image-search");
    expect(await searchPexels("beef")).toEqual([]);
  });
});
