// @vitest-environment node
// Order of a product's photos and which one is primary (src/lib/images/rank.ts), the one rule
// behind the server write plan, the storefront photo and the butcher's photo tiles.
import { describe, expect, it } from "vitest";
import { rankProductPhotos } from "@/lib/images/rank";

const urlsOf = (photos: readonly { url: string }[]) => photos.map((photo) => photo.url);

describe("rankProductPhotos", () => {
  it("empty list: no photo, no primary", () => {
    expect(rankProductPhotos([])).toEqual({ photos: [], primary: null });
  });

  it("order missing: the position stands for it", () => {
    const ranked = rankProductPhotos([{ url: "a" }, { url: "b", order: 0 }, { url: "c" }]);
    expect(urlsOf(ranked.photos)).toEqual(["a", "b", "c"]);
    expect(ranked.primary?.url).toBe("a");
  });

  it("orders sort first, ties keep their input position", () => {
    const ranked = rankProductPhotos([
      { url: "late", order: 7 },
      { url: "tie-1", order: 2 },
      { url: "tie-2", order: 2 },
      { url: "null-order", order: null },
    ]);
    expect(urlsOf(ranked.photos)).toEqual(["tie-1", "tie-2", "null-order", "late"]);
  });

  it("primary: the first photo flagged in the ranked order, whatever its order", () => {
    const ranked = rankProductPhotos([
      { url: "a", order: 0, isPrimary: false },
      { url: "late-flag", order: 3, isPrimary: true },
      { url: "early-flag", order: 1, isPrimary: true },
    ]);
    expect(urlsOf(ranked.photos)).toEqual(["a", "early-flag", "late-flag"]);
    expect(ranked.primary?.url).toBe("early-flag");
  });

  it("no flag: the first photo of the ranked order is primary", () => {
    expect(
      rankProductPhotos([
        { url: "b", order: 2 },
        { url: "a", order: 1 },
      ]).primary?.url
    ).toBe("a");
  });

  it("duplicate URLs: the first occurrence in input order wins, before sorting", () => {
    const ranked = rankProductPhotos([
      { url: "A", order: 5 },
      { url: "B", order: 1 },
      { url: "A", order: 0 },
    ]);
    expect(ranked.photos).toEqual([
      { url: "B", order: 1 },
      { url: "A", order: 5 },
    ]);
    expect(ranked.primary).toEqual({ url: "B", order: 1 });
  });

  it("returns the caller's own objects", () => {
    const first = { url: "a", order: 1, alt: "Merguez" };
    const second = { url: "b", order: 0, alt: "Kefta" };
    const ranked = rankProductPhotos([first, second]);
    expect(ranked.photos[1]).toBe(first);
    expect(ranked.primary).toBe(second);
  });
});
