// @vitest-environment node
//
// Tests for the pure formatters used in Kitchen Mode (KitchenOrderCard +
// OrderTicket). These were duplicated in two components; we extracted them
// to src/lib/format-kitchen.ts so they can be unit-tested without booting
// React/jsdom and so the logic stays consistent across both call sites.

import { describe, it, expect } from "vitest";
import {
  formatClientName,
  formatPriceCents,
  formatUnit,
  isAsapTime,
  formatTime,
  timeSince,
  formatCountdown,
} from "@/lib/format-kitchen";

describe("formatClientName", () => {
  it("should produce 'Firstname.L' for a regular first+last name", () => {
    // CLAUDE.md spec: "Tarik.B, Fatima.A" everywhere
    expect(formatClientName("tarik", "boudefar")).toBe("Tarik.B");
    expect(formatClientName("FATIMA", "ait")).toBe("Fatima.A");
  });

  it("should fall back to 'Client' when no first name is provided", () => {
    // Defensive: protects the kitchen receipt from rendering an empty header
    expect(formatClientName("", "Doe")).toBe("Client");
  });

  it("should drop the dot when no last name is provided", () => {
    expect(formatClientName("amina", "")).toBe("Amina");
  });
});

describe("formatPriceCents", () => {
  it("should format a price in cents with French comma + euro sign", () => {
    expect(formatPriceCents(1234)).toBe("12,34 €");
  });

  it("should pad cents to two digits", () => {
    // 100 cents = 1.00 €, must keep the trailing zeros
    expect(formatPriceCents(100)).toBe("1,00 €");
  });

  it("should handle zero", () => {
    expect(formatPriceCents(0)).toBe("0,00 €");
  });
});

describe("formatUnit", () => {
  it("should map known Prisma Unit enum values to their display labels", () => {
    expect(formatUnit("KG")).toBe("kg");
    expect(formatUnit("PIECE")).toBe("pc");
    expect(formatUnit("TRANCHE")).toBe("tr.");
    expect(formatUnit("BARQUETTE")).toBe("barq.");
  });

  it("should fall through to 'barq.' for any unknown unit", () => {
    // Mirrors the original component behavior (any other value falls through)
    expect(formatUnit("UNKNOWN")).toBe("barq.");
  });
});

describe("isAsapTime", () => {
  it("should detect the literal 'asap' marker case-insensitively", () => {
    expect(isAsapTime("asap")).toBe(true);
    expect(isAsapTime("ASAP")).toBe(true);
  });

  it("should return false for any other value (including null and times)", () => {
    expect(isAsapTime(null)).toBe(false);
    expect(isAsapTime("13:30")).toBe(false);
    expect(isAsapTime("")).toBe(false);
  });
});

describe("formatTime", () => {
  it("should format an ISO datetime string as zero-padded HH:MM in fr-FR", () => {
    // 09:05 UTC: this test fixes the value to a UTC ISO string and asserts on
    // the *local* render — to keep it deterministic across CI timezones we
    // pick a date and read back via the same locale options used in prod.
    const iso = "2024-06-01T13:05:00Z";
    const expected = new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(formatTime(iso)).toBe(expected);
  });
});

describe("timeSince", () => {
  // Fix `now` so the test is deterministic and survives CI clock drift
  const NOW = new Date("2024-06-01T12:00:00Z").getTime();

  it("should return '< 1 min' when the diff is under one minute", () => {
    const ts = new Date(NOW - 30_000).toISOString(); // 30s ago
    expect(timeSince(ts, NOW)).toBe("< 1 min");
  });

  it("should return 'N min' for diffs under one hour", () => {
    const ts = new Date(NOW - 5 * 60_000).toISOString(); // 5 min ago
    expect(timeSince(ts, NOW)).toBe("5 min");
  });

  it("should return 'Hh MM' (with zero-pad) for diffs over one hour", () => {
    const ts = new Date(NOW - (2 * 60 + 5) * 60_000).toISOString(); // 2h05 ago
    expect(timeSince(ts, NOW)).toBe("2h05");
  });
});

describe("formatCountdown", () => {
  it("should return 'Maintenant' when the countdown has elapsed", () => {
    expect(formatCountdown(0)).toBe("Maintenant");
    expect(formatCountdown(-1000)).toBe("Maintenant");
  });

  it("should return 'Dans N min' when under one hour remains", () => {
    expect(formatCountdown(15 * 60_000)).toBe("Dans 15 min");
  });

  it("should return 'Dans Xh' (no minutes) when on a clean hour boundary", () => {
    expect(formatCountdown(2 * 60 * 60_000)).toBe("Dans 2h");
  });

  it("should return 'Dans XhMM' (zero-padded minutes) for arbitrary durations", () => {
    expect(formatCountdown((2 * 60 + 7) * 60_000)).toBe("Dans 2h07");
  });
});
