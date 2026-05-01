// @vitest-environment node
//
// Generic display formatters from src/lib/utils.ts. These run in many UI
// branches; small drifts here change the look of every product card and
// receipt.

import { describe, it, expect } from "vitest";
import {
  cn,
  formatPrice,
  formatShortTime,
  formatWeight,
  parsePagination,
} from "@/lib/utils";

describe("cn (Tailwind class merger)", () => {
  it("should merge conditional class lists, dropping falsy values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("should let later utilities win over conflicting earlier ones (twMerge contract)", () => {
    // The whole point of twMerge: 'p-2' is dropped because 'p-4' takes precedence
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("formatPrice", () => {
  it("should format a price in cents as 'X,YZ €' (French comma + euro sign)", () => {
    expect(formatPrice(1234)).toBe("12,34 €");
    expect(formatPrice(50)).toBe("0,50 €");
  });
});

describe("formatShortTime", () => {
  it("should render durations under 60 min as 'N min'", () => {
    expect(formatShortTime(45)).toBe("45 min");
  });

  it("should render durations over 60 min as 'HhMM' with zero-padded minutes", () => {
    // 75 min = 1h15
    expect(formatShortTime(75)).toBe("1h15");
    // Exact hour boundary still pads minutes
    expect(formatShortTime(60)).toBe("1h00");
  });
});

describe("formatWeight", () => {
  it("should keep grams under 1kg as 'Ng'", () => {
    expect(formatWeight(500)).toBe("500 g");
  });

  it("should switch to kg with one decimal at and above 1kg", () => {
    expect(formatWeight(1500)).toBe("1.5 kg");
    expect(formatWeight(1000)).toBe("1.0 kg");
  });
});

describe("parsePagination", () => {
  it("should fall back to defaults when no params are present", () => {
    const params = new URLSearchParams();
    expect(parsePagination(params)).toEqual({ page: 1, perPage: 20, skip: 0 });
  });

  it("should parse page + perPage from the URL and compute skip correctly", () => {
    // page=3, perPage=10 -> skip=20
    const params = new URLSearchParams({ page: "3", perPage: "10" });
    expect(parsePagination(params)).toEqual({ page: 3, perPage: 10, skip: 20 });
  });

  it("should clamp perPage to a max of 100 (defense against DoS-ish queries)", () => {
    const params = new URLSearchParams({ perPage: "999" });
    const out = parsePagination(params);
    expect(out.perPage).toBe(100);
  });

  it("should coerce invalid input to safe defaults", () => {
    // Negative page → 1, zero perPage → at least 1
    const params = new URLSearchParams({ page: "-5", perPage: "0" });
    const out = parsePagination(params);
    expect(out.page).toBe(1);
    expect(out.perPage).toBeGreaterThanOrEqual(1);
  });
});
