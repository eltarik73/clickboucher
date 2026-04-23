// tests/lib/shop-hours.test.ts
import { describe, it, expect } from "vitest";
import { getShopStatus, formatClosingHint } from "@/lib/shop-hours";

const HOURS = {
  sun: { open: "09:00", close: "13:00" },
  mon: { open: "08:00", close: "19:30" },
  tue: { open: "08:00", close: "19:30" },
  wed: { open: "08:00", close: "19:30" },
  thu: { open: "08:00", close: "19:30" },
  fri: { open: "08:00", close: "19:30" },
  sat: { open: "08:00", close: "19:30" },
};

/** Build a Date at the local day-of-week and time. 0=sun, 1=mon, ... */
function d(dayOfWeek: number, h: number, m: number): Date {
  // 2026-04-19 is a Sunday. Offset by dayOfWeek to hit the target day.
  const base = new Date(2026, 3, 19 + dayOfWeek, h, m, 0, 0);
  return base;
}

describe("getShopStatus", () => {
  it("returns OPEN when well within opening hours", () => {
    const result = getShopStatus(HOURS, d(1, 12, 0)); // Monday 12:00
    expect(result.status).toBe("OPEN");
  });

  it("returns CLOSING_SOON when within 60 minutes of close", () => {
    const result = getShopStatus(HOURS, d(1, 18, 45)); // Monday 18:45, closes 19:30
    expect(result.status).toBe("CLOSING_SOON");
    if (result.status === "CLOSING_SOON") {
      expect(result.minutesLeft).toBe(45);
      expect(result.closesAt.getHours()).toBe(19);
      expect(result.closesAt.getMinutes()).toBe(30);
    }
  });

  it("returns CLOSED before open time", () => {
    const result = getShopStatus(HOURS, d(1, 6, 0));
    expect(result.status).toBe("CLOSED");
  });

  it("returns CLOSED after closing time", () => {
    const result = getShopStatus(HOURS, d(1, 20, 0));
    expect(result.status).toBe("CLOSED");
  });

  it("returns CLOSED for a day with no entry", () => {
    const result = getShopStatus({ mon: { open: "08:00", close: "19:00" } }, d(0, 10, 0));
    expect(result.status).toBe("CLOSED");
  });

  it("returns CLOSED when openingHours is null or empty", () => {
    expect(getShopStatus(null, d(1, 12, 0)).status).toBe("CLOSED");
    expect(getShopStatus({}, d(1, 12, 0)).status).toBe("CLOSED");
  });

  it("handles malformed HH:MM gracefully", () => {
    const bad = { mon: { open: "notatime", close: "19:00" } };
    expect(getShopStatus(bad, d(1, 12, 0)).status).toBe("CLOSED");
  });
});

describe("formatClosingHint", () => {
  it("formats a closing time with h and padded minutes", () => {
    const hint = formatClosingHint({
      status: "CLOSING_SOON",
      closesAt: new Date(2026, 3, 20, 19, 30),
      minutesLeft: 45,
    });
    expect(hint).toBe("Ferme à 19h30");
  });

  it("uses the countdown form under 30 minutes", () => {
    const hint = formatClosingHint({
      status: "CLOSING_SOON",
      closesAt: new Date(2026, 3, 20, 19, 30),
      minutesLeft: 20,
    });
    expect(hint).toBe("Ferme dans 20 min");
  });
});
