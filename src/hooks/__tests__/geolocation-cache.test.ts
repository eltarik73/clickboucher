// The position cached in « klikgo-geo » has one reader, readCachedPosition, used by the position
// card (useGeolocation) and by the home shop list (NearbyShops): both refuse the same entries.
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCachedPosition, useGeolocation } from "@/hooks/useGeolocation";

const NOW = new Date("2026-11-15T10:00:00.000Z").getTime();
const HOUR_MS = 60 * 60 * 1000;

function cache(entry: unknown) {
  localStorage.setItem("klikgo-geo", JSON.stringify(entry));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("readCachedPosition", () => {
  it("reads a position chosen less than 24 hours ago, with its city", () => {
    cache({ lat: 45.57, lng: 5.92, city: "Chambéry", ts: NOW - 23 * HOUR_MS });

    expect(readCachedPosition()).toEqual({ latitude: 45.57, longitude: 5.92, city: "Chambéry" });
  });

  it("keeps a position without a city name", () => {
    cache({ lat: 45.57, lng: 5.92, city: null, ts: NOW });

    expect(readCachedPosition()).toEqual({ latitude: 45.57, longitude: 5.92, city: null });
  });

  it("ignores a position chosen more than 24 hours ago", () => {
    cache({ lat: 45.57, lng: 5.92, city: "Chambéry", ts: NOW - 25 * HOUR_MS });

    expect(readCachedPosition()).toBeNull();
  });

  it.each([
    ["a latitude JSON wrote as null (NaN)", { lat: null, lng: 5.92, ts: NOW }],
    ["a longitude stored as text", { lat: 45.57, lng: "5.92", ts: NOW }],
    ["no date", { lat: 45.57, lng: 5.92 }],
    ["a date that is not a number", { lat: 45.57, lng: 5.92, ts: "hier" }],
    ["a value that is not an object", 45.57],
  ])("ignores an entry with %s", (_case, entry) => {
    cache(entry);

    expect(readCachedPosition()).toBeNull();
  });

  it("ignores (0, 0), but keeps a position on the equator or on the prime meridian", () => {
    cache({ lat: 0, lng: 0, ts: NOW });
    expect(readCachedPosition()).toBeNull();

    cache({ lat: 45.57, lng: 0, ts: NOW });
    expect(readCachedPosition()).toEqual({ latitude: 45.57, longitude: 0, city: null });

    cache({ lat: 0, lng: 5.92, ts: NOW });
    expect(readCachedPosition()).toEqual({ latitude: 0, longitude: 5.92, city: null });
  });

  it("is null when nothing is stored, or when the entry is not JSON", () => {
    expect(readCachedPosition()).toBeNull();

    localStorage.setItem("klikgo-geo", "{lat: 45.57");
    expect(readCachedPosition()).toBeNull();
  });

  it("is null when the browser blocks the storage", () => {
    cache({ lat: 45.57, lng: 5.92, ts: NOW });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    expect(readCachedPosition()).toBeNull();
  });
});

describe("useGeolocation", () => {
  it("starts from the cached position", () => {
    cache({ lat: 45.57, lng: 5.92, city: "Chambéry", ts: NOW });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current).toMatchObject({
      latitude: 45.57,
      longitude: 5.92,
      city: "Chambéry",
      loading: false,
      error: null,
    });
  });

  it("starts without a position when (0, 0) is cached", () => {
    cache({ lat: 0, lng: 0, city: "Atlantique", ts: NOW });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current).toMatchObject({ latitude: null, longitude: null, city: null });
    expect(result.current.loading).toBe(false);
  });
});
