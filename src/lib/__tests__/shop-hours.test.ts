// @vitest-environment node
//
// Shop opening-hours computation. Drives the badges on every shop card
// (Open, Closing soon, Closed). A regression here would either misrepresent
// availability or hide perfectly open shops.

import { describe, it, expect } from "vitest";
import { getShopStatus, getDayHours, formatClosingHint } from "@/lib/shop-hours";

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

// Les boutiques enregistrent leurs horaires avec des clés françaises
// (réglages boucher, seed, créneaux de retrait). Régression historique : les
// lecteurs n'acceptaient que mon…sun, donc toute boutique apparaissait « Fermé ».
describe("clés de jour françaises (format réellement stocké)", () => {
  const HOURS_FR = {
    lundi: { open: "09:00", close: "19:00" },
    samedi: { open: "09:00", close: "19:00" },
    dimanche: null,
  };

  it("getShopStatus lit les clés françaises", () => {
    expect(getShopStatus(HOURS_FR, at("12:00")).status).toBe("OPEN");
    expect(getShopStatus(HOURS_FR, at("08:00")).status).toBe("CLOSED");
    expect(getShopStatus(HOURS_FR, at("18:30")).status).toBe("CLOSING_SOON");
  });

  it("getDayHours accepte les deux jeux de clés, le français d'abord", () => {
    expect(getDayHours(HOURS_FR, 6)).toEqual({ open: "09:00", close: "19:00" });
    expect(getDayHours(HOURS_FR, 1)).toEqual({ open: "09:00", close: "19:00" });
    expect(getDayHours({ sat: { open: "10:00", close: "12:00" } }, 6)).toEqual({ open: "10:00", close: "12:00" });
    expect(
      getDayHours({ samedi: { open: "09:00", close: "19:00" }, sat: { open: "10:00", close: "12:00" } }, 6)
    ).toEqual({ open: "09:00", close: "19:00" });
  });

  it("getDayHours renvoie null pour un jour fermé, absent ou incomplet", () => {
    expect(getDayHours(HOURS_FR, 0)).toBeNull();
    expect(getDayHours(HOURS_FR, 2)).toBeNull();
    expect(getDayHours({ mardi: { open: "", close: "19:00" } }, 2)).toBeNull();
    expect(getDayHours(null, 1)).toBeNull();
    expect(getDayHours(undefined, 1)).toBeNull();
  });
});
