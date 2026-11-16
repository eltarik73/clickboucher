// @vitest-environment node
// The JSON of the Redis entries keeps dates: a cached row comes back with the types Prisma gave it.
import { describe, expect, it } from "vitest";
import { decodeCacheValue, encodeCacheValue } from "@/lib/cache/codec";

const row = {
  id: "prod_1",
  antiGaspiEndAt: new Date("2026-11-15T18:00:00.000Z"),
  promoEnd: null,
  // A Json column: a string that looks like a date stays a string.
  cutOptions: { note: "2026-11-14T05:30:00.000Z" },
  images: [{ id: "img_1", createdAt: new Date("2026-03-05T09:00:00.000Z") }],
};

describe("encodeCacheValue / decodeCacheValue", () => {
  it("brings dates back as Date, from the text or from the JSON @upstash/redis already parsed", () => {
    const text = encodeCacheValue([row]);

    expect(decodeCacheValue(text)).toEqual([row]);
    expect(decodeCacheValue(JSON.parse(text))).toEqual([row]);
    const [decoded] = decodeCacheValue(text) as [typeof row];
    expect(decoded.antiGaspiEndAt).toBeInstanceOf(Date);
    expect(decoded.images[0].createdAt.toISOString()).toBe("2026-03-05T09:00:00.000Z");
  });

  it.each([
    ["truncated JSON", '[{"id":"prod_1"'],
    ["text that is not JSON", "pas une liste"],
    ["a tagged date that is not a date", '[{"id":"prod_1","promoEnd":{"$date":"pas une date"}}]'],
    ["a tagged date that is not a string", '[{"id":"prod_1","promoEnd":{"$date":12}}]'],
  ])("is undefined for %s", (_label, text) => {
    expect(decodeCacheValue(text)).toBeUndefined();
  });

  it("keeps an unknown tag as data", () => {
    expect(decodeCacheValue('{"total":{"$bigint":"12"}}')).toEqual({ total: { $bigint: "12" } });
  });

  it("keeps a __proto__ key as data, without touching the prototype", () => {
    const decoded = decodeCacheValue('{"__proto__":{"polluted":true}}') as Record<string, unknown>;

    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
