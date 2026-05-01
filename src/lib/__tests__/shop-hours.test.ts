// @vitest-environment node
//
// Shop opening-hours computation. Drives the badges on every shop card
// (Open, Closing soon, Closed). A regression here would either misrepresent
// availability or hide perfectly open shops.

import { describe, it, expect } from "vitest";
import { getShopStatus, formatClosingHint } from "@/lib/shop-hours";

// Helpers — using a fixed Saturday "2024-06-01" so we always know which day
// key (sat / sun / mon …) the function will pick.
function at(localTime: string): Date {
  // Saturday 2024-06-01 in local time, parse "HH:MM"
  const [h, m] = localTime.split(":").map((n) => parseInt(n, 10));
  const d = new Date(2024, 5, 1, h, m, 0, 0); // local time: Saturday
  return d;
}

const HOURS = {
  sat: { open: "09:00", close: "19:00" },
};

describe("getShopStatus", () => {
  it("should return CLOSED when openingHours is null/undefined/empty", () => {
    expect(getShopStatus(null).status).toBe("CLOSED");
    expect(getShopStatus(undefined).status).toBe("CLOSED");
    expect(getShopStatus({}, at("12:00")).status).toBe("CLOSED");
  });

  it("should return CLOSED before opening time", () => {
    // 08:30 is before the 09:00 open
    expect(getShopStatus(HOURS, at("08:30")).status).toBe("CLOSED");
  });

  it("should return OPEN well within working hours", () => {
    // 12:00 is comfortably inside 09:00-19:00 with >60min remaining
    expect(getShopStatus(HOURS, at("12:00")).status).toBe("OPEN");
  });

  it("should return CLOSING_SOON when less than 60 min remain before close", () => {
    // 18:30 → 30 min before close
    const result = getShopStatus(HOURS, at("18:30"));
    expect(result.status).toBe("CLOSING_SOON");
    if (result.status === "CLOSING_SOON") {
      expect(result.minutesLeft).toBe(30);
    }
  });

  it("should return CLOSED at or after closing time", () => {
    // The contract is `nowMin >= closeMin → CLOSED` (strict half-open interval)
    expect(getShopStatus(HOURS, at("19:00")).status).toBe("CLOSED");
    expect(getShopStatus(HOURS, at("19:30")).status).toBe("CLOSED");
  });
});

describe("formatClosingHint", () => {
  it("should format 'Ferme dans N min' when under 30 min remain", () => {
    const closesAt = new Date(2024, 5, 1, 19, 0, 0);
    expect(
      formatClosingHint({ status: "CLOSING_SOON", closesAt, minutesLeft: 25 }),
    ).toBe("Ferme dans 25 min");
  });

  it("should format 'Ferme à HhMM' (zero-padded minutes) for 30-60 min remaining", () => {
    const closesAt = new Date(2024, 5, 1, 19, 5, 0); // closes at 19:05 local
    expect(
      formatClosingHint({ status: "CLOSING_SOON", closesAt, minutesLeft: 45 }),
    ).toBe("Ferme à 19h05");
  });
});
