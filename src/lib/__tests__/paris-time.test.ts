// @vitest-environment node
//
// Heure murale Europe/Paris. Les fonctions Vercel tournent en UTC : sans ces
// helpers, le statut "Ouvert / Fermé" et les créneaux de retrait sont décalés
// de 1 h (hiver) ou 2 h (été). Les instants sont donnés en UTC pour que les
// tests passent quel que soit le fuseau de la machine (CI en UTC, Mac à Paris).

import { describe, it, expect } from "vitest";
import {
  PARIS_TIME_ZONE,
  PICKUP_MARGIN_MIN,
  earliestPickupMinutes,
  getParisWallClock,
  parisWallClockToUtc,
  toParisWallClockDate,
} from "@/lib/paris-time";
import { getShopStatus } from "@/lib/shop-hours";

const utc = (iso: string) => new Date(`${iso}Z`);

describe("getParisWallClock", () => {
  it("should apply UTC+1 in winter (CET)", () => {
    const paris = getParisWallClock(utc("2026-01-15T12:09:00"));
    expect(paris).toMatchObject({
      year: 2026,
      month: 1,
      day: 15,
      hour: 13,
      minute: 9,
      second: 0,
      weekday: 4, // jeudi
      dateKey: "2026-01-15",
      minutesOfDay: 13 * 60 + 9,
    });
  });

  it("should apply UTC+2 in summer (CEST)", () => {
    const paris = getParisWallClock(utc("2026-07-15T11:22:00"));
    expect(paris).toMatchObject({
      year: 2026,
      month: 7,
      day: 15,
      hour: 13,
      minute: 22,
      weekday: 3, // mercredi
      dateKey: "2026-07-15",
      minutesOfDay: 13 * 60 + 22,
    });
  });

  it("should roll over to the next day after Paris midnight in winter", () => {
    // 23:30 UTC le jeudi 15 = 00:30 à Paris le vendredi 16
    const after = getParisWallClock(utc("2026-01-15T23:30:00"));
    expect(after.dateKey).toBe("2026-01-16");
    expect(after.weekday).toBe(5);
    expect(after.hour).toBe(0);
    expect(after.minutesOfDay).toBe(30);

    // 22:59:59 UTC = 23:59:59 à Paris, encore le 15
    const before = getParisWallClock(utc("2026-01-15T22:59:59"));
    expect(before.dateKey).toBe("2026-01-15");
    expect(before.weekday).toBe(4);
    expect(before.minutesOfDay).toBe(23 * 60 + 59);
    expect(before.second).toBe(59);
  });

  it("should roll over to the next day after Paris midnight in summer", () => {
    // 22:00 UTC le mercredi 15 = 00:00 pile à Paris le jeudi 16 (heure 0, jamais 24)
    const midnight = getParisWallClock(utc("2026-07-15T22:00:00"));
    expect(midnight.dateKey).toBe("2026-07-16");
    expect(midnight.weekday).toBe(4);
    expect(midnight.hour).toBe(0);
    expect(midnight.minutesOfDay).toBe(0);

    // 21:59 UTC = 23:59 à Paris, encore le 15
    const before = getParisWallClock(utc("2026-07-15T21:59:00"));
    expect(before.dateKey).toBe("2026-07-15");
    expect(before.weekday).toBe(3);
    expect(before.minutesOfDay).toBe(23 * 60 + 59);
  });

  it("should roll over month and year at Paris midnight", () => {
    const paris = getParisWallClock(utc("2026-12-31T23:30:00"));
    expect(paris.dateKey).toBe("2027-01-01");
    expect(paris.weekday).toBe(5); // vendredi
    expect(paris.minutesOfDay).toBe(30);
  });

  it("should skip 02:00–03:00 on the spring-forward day", () => {
    // Dimanche 29 mars 2026 : à 01:00 UTC, Paris passe de 02:00 à 03:00
    expect(getParisWallClock(utc("2026-03-29T00:59:00"))).toMatchObject({ hour: 1, minute: 59 });
    expect(getParisWallClock(utc("2026-03-29T01:00:00"))).toMatchObject({
      hour: 3,
      minute: 0,
      dateKey: "2026-03-29",
      weekday: 0,
    });
  });

  it("should replay 02:00–03:00 on the fall-back day", () => {
    // Dimanche 25 octobre 2026 : à 01:00 UTC, Paris revient de 03:00 à 02:00
    expect(getParisWallClock(utc("2026-10-25T00:30:00"))).toMatchObject({ hour: 2, minute: 30 });
    expect(getParisWallClock(utc("2026-10-25T01:30:00"))).toMatchObject({ hour: 2, minute: 30 });
    expect(getParisWallClock(utc("2026-10-25T02:30:00"))).toMatchObject({ hour: 3, minute: 30 });
  });

  it("should expose the Europe/Paris zone name", () => {
    expect(PARIS_TIME_ZONE).toBe("Europe/Paris");
  });
});

describe("toParisWallClockDate", () => {
  it("should expose Paris wall-clock time through local getters in winter", () => {
    const d = toParisWallClockDate(utc("2026-01-15T12:09:00"));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 15]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([13, 9, 0]);
    expect(d.getDay()).toBe(4);
  });

  it("should expose Paris wall-clock time through local getters in summer", () => {
    const d = toParisWallClockDate(utc("2026-07-15T11:22:00"));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 15]);
    expect([d.getHours(), d.getMinutes()]).toEqual([13, 22]);
    expect(d.getDay()).toBe(3);
  });

  it("should expose the next weekday after Paris midnight", () => {
    const d = toParisWallClockDate(utc("2026-07-15T22:00:00"));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 16]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
    expect(d.getDay()).toBe(4);
  });
});

describe("getShopStatus with a Paris wall-clock date", () => {
  const HOURS = {
    wed: { open: "08:00", close: "19:00" },
    thu: { open: "09:00", close: "19:00" },
  };

  it("should be CLOSED after Paris closing time in winter (server clock still says 18:30)", () => {
    // 18:30 UTC = 19:30 à Paris, jeudi
    const now = toParisWallClockDate(utc("2026-01-15T18:30:00"));
    expect(getShopStatus(HOURS, now).status).toBe("CLOSED");
  });

  it("should be CLOSING_SOON with the Paris minutes left in winter", () => {
    // 17:30 UTC = 18:30 à Paris → ferme dans 30 min
    const status = getShopStatus(HOURS, toParisWallClockDate(utc("2026-01-15T17:30:00")));
    expect(status.status).toBe("CLOSING_SOON");
    if (status.status === "CLOSING_SOON") expect(status.minutesLeft).toBe(30);
  });

  it("should be OPEN after Paris opening time in summer (server clock still says 06:30)", () => {
    // 06:30 UTC = 08:30 à Paris, mercredi
    const now = toParisWallClockDate(utc("2026-07-15T06:30:00"));
    expect(getShopStatus(HOURS, now).status).toBe("OPEN");
  });

  it("should be CLOSED after Paris closing time in summer (server clock still says 17:30)", () => {
    // 17:30 UTC = 19:30 à Paris
    const now = toParisWallClockDate(utc("2026-07-15T17:30:00"));
    expect(getShopStatus(HOURS, now).status).toBe("CLOSED");
  });

  it("should use the Paris weekday just after midnight", () => {
    // 23:30 UTC jeudi = 00:30 vendredi à Paris : aucune plage le vendredi
    const lateOnly = { thu: { open: "00:00", close: "23:59" } };
    const now = toParisWallClockDate(utc("2026-01-15T23:30:00"));
    expect(getShopStatus(lateOnly, now).status).toBe("CLOSED");
  });
});

describe("earliestPickupMinutes", () => {
  const hm = (h: number, m: number) => h * 60 + m;

  it("should default to a 10 min margin", () => {
    expect(PICKUP_MARGIN_MIN).toBe(10);
  });

  it("should round now + 10 min UP to the next 30 min slot (CLAUDE.md examples)", () => {
    expect(earliestPickupMinutes(hm(13, 9), 30)).toBe(hm(13, 30));
    expect(earliestPickupMinutes(hm(13, 22), 30)).toBe(hm(14, 0));
    expect(earliestPickupMinutes(hm(14, 5), 30)).toBe(hm(14, 30));
    expect(earliestPickupMinutes(hm(14, 31), 30)).toBe(hm(15, 0));
  });

  it("should keep a slot that is exactly now + 10 min", () => {
    expect(earliestPickupMinutes(hm(13, 20), 30)).toBe(hm(13, 30));
    expect(earliestPickupMinutes(hm(13, 50), 30)).toBe(hm(14, 0));
  });

  it("should honour other intervals and margins", () => {
    expect(earliestPickupMinutes(hm(13, 9), 15)).toBe(hm(13, 30));
    expect(earliestPickupMinutes(hm(13, 22), 60)).toBe(hm(14, 0));
    expect(earliestPickupMinutes(hm(13, 9), 30, 30)).toBe(hm(14, 0));
  });

  it("should not wrap past midnight late in the evening", () => {
    // 23:55 + 10 → 24:30 : au-delà de tout créneau du jour, donc aucun créneau restant
    expect(earliestPickupMinutes(hm(23, 55), 30)).toBe(24 * 60 + 30);
  });

  it("should apply the slot rule on Paris time in winter", () => {
    // 12:09 UTC = 13:09 à Paris → 13:30 | 13:05 UTC = 14:05 à Paris → 14:30
    const a = getParisWallClock(utc("2026-01-15T12:09:00"));
    const b = getParisWallClock(utc("2026-01-15T13:05:00"));
    expect(earliestPickupMinutes(a.minutesOfDay, 30)).toBe(hm(13, 30));
    expect(earliestPickupMinutes(b.minutesOfDay, 30)).toBe(hm(14, 30));
  });

  it("should apply the slot rule on Paris time in summer", () => {
    // 11:22 UTC = 13:22 à Paris → 14:00 | 12:31 UTC = 14:31 à Paris → 15:00
    const a = getParisWallClock(utc("2026-07-15T11:22:00"));
    const b = getParisWallClock(utc("2026-07-15T12:31:00"));
    expect(earliestPickupMinutes(a.minutesOfDay, 30)).toBe(hm(14, 0));
    expect(earliestPickupMinutes(b.minutesOfDay, 30)).toBe(hm(15, 0));
  });
});

describe("parisWallClockToUtc", () => {
  it("should subtract 1 h in winter and 2 h in summer", () => {
    expect(parisWallClockToUtc("2026-01-15", 13 * 60 + 30).toISOString()).toBe("2026-01-15T12:30:00.000Z");
    expect(parisWallClockToUtc("2026-07-15", 13 * 60 + 30).toISOString()).toBe("2026-07-15T11:30:00.000Z");
  });

  it("should handle midnight and the end-of-day bound (1440 min)", () => {
    expect(parisWallClockToUtc("2026-01-15", 0).toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(parisWallClockToUtc("2026-01-15", 24 * 60).toISOString()).toBe("2026-01-15T23:00:00.000Z");
    expect(parisWallClockToUtc("2026-07-01", 0).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("should stay correct on both DST transition days", () => {
    // 29 mars 2026 : passage à l'heure d'été à 02h00 (→ 03h00)
    expect(parisWallClockToUtc("2026-03-29", 90).toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(parisWallClockToUtc("2026-03-29", 10 * 60).toISOString()).toBe("2026-03-29T08:00:00.000Z");
    // 25 octobre 2026 : retour à l'heure d'hiver à 03h00 (→ 02h00)
    expect(parisWallClockToUtc("2026-10-25", 60).toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(parisWallClockToUtc("2026-10-25", 10 * 60).toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });

  it("should round-trip with getParisWallClock", () => {
    const instant = parisWallClockToUtc("2026-11-13", 9 * 60 + 30);
    expect(getParisWallClock(instant)).toMatchObject({ dateKey: "2026-11-13", minutesOfDay: 9 * 60 + 30 });
  });
});
