// @vitest-environment node
//
// Formats of the three numbers printed on tickets, e-mails and screens.
// The order number is stored under a unique index: its format must stay
// disjoint from the "KG-YYYY-NNNNN" numbers allocated by the previous code,
// which keeps running during a deploy and after a rollback.

import { describe, it, expect } from "vitest";
import {
  formatCustomerNumber,
  formatDisplayNumber,
  formatOrderNumber,
} from "@/lib/order-number-format";

describe("formatOrderNumber", () => {
  it("should build KG + 2-digit year + '-' + 6-digit sequence", () => {
    expect(formatOrderNumber(2026, 166)).toBe("KG26-000166");
    expect(formatOrderNumber(2031, 5)).toBe("KG31-000005");
    expect(formatOrderNumber(2026, 1)).toBe("KG26-000001");
    expect(formatOrderNumber(2026, 999999)).toBe("KG26-999999");
  });

  it("should keep every digit of a sequence longer than 6 digits", () => {
    expect(formatOrderNumber(2026, 1234567)).toBe("KG26-1234567");
  });

  it("should pad the year to 2 digits", () => {
    expect(formatOrderNumber(2105, 12)).toBe("KG05-000012");
    expect(formatOrderNumber(2100, 12)).toBe("KG00-000012");
  });

  it("should never produce a number in the legacy 'KG-20YY-' namespace", () => {
    const legacy = /^KG-\d{4}-/;
    for (const year of [2025, 2026, 2027, 2031, 2099, 2100]) {
      for (const sequence of [1, 42, 165, 166, 99999, 100000, 1234567]) {
        const orderNumber = formatOrderNumber(year, sequence);
        expect(orderNumber.startsWith("KG-20"), orderNumber).toBe(false);
        expect(legacy.test(orderNumber), orderNumber).toBe(false);
        expect(orderNumber).toMatch(/^KG\d{2}-\d{6,}$/);
      }
    }
  });

  it("should sort like the sequence within a year while it has 6 digits", () => {
    const numbers = [9, 10, 99, 100, 165, 166, 99999, 100000, 999999].map((n) =>
      formatOrderNumber(2026, n)
    );
    expect([...numbers].sort()).toEqual(numbers);
  });

  it("should refuse a sequence or a year that is not a non-negative integer", () => {
    expect(() => formatOrderNumber(2026, 1.5)).toThrow(RangeError);
    expect(() => formatOrderNumber(2026, -1)).toThrow(RangeError);
    expect(() => formatOrderNumber(2026, Number.NaN)).toThrow(RangeError);
    expect(() => formatOrderNumber(2026.5, 1)).toThrow(RangeError);
    expect(() => formatOrderNumber(-2026, 1)).toThrow(RangeError);
  });
});

describe("formatDisplayNumber", () => {
  it("should build the ticket number of the day on 3 digits", () => {
    expect(formatDisplayNumber(12)).toBe("#012");
    expect(formatDisplayNumber(1)).toBe("#001");
    expect(formatDisplayNumber(999)).toBe("#999");
  });

  it("should keep every digit above 999", () => {
    expect(formatDisplayNumber(1000)).toBe("#1000");
  });

  it("should refuse a number that is not a non-negative integer", () => {
    expect(() => formatDisplayNumber(1.2)).toThrow(RangeError);
    expect(() => formatDisplayNumber(-3)).toThrow(RangeError);
    expect(() => formatDisplayNumber(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatCustomerNumber", () => {
  it("should build 'C-' + the number on 3 digits", () => {
    expect(formatCustomerNumber(12)).toBe("C-012");
    expect(formatCustomerNumber(7)).toBe("C-007");
  });

  it("should keep every digit above 999", () => {
    expect(formatCustomerNumber(1234)).toBe("C-1234");
  });

  it("should return null when the order carries no customer number", () => {
    // Orders created by the previous code during a deploy have no snapshot
    expect(formatCustomerNumber(null)).toBeNull();
    expect(formatCustomerNumber(undefined)).toBeNull();
  });

  it("should print the same text as the legacy 'C-NNN' string it was migrated from", () => {
    for (const legacy of ["C-001", "C-028", "C-999", "C-1000"]) {
      const migrated = Number.parseInt(legacy.slice(2), 10);
      expect(formatCustomerNumber(migrated)).toBe(legacy);
    }
  });

  it("should refuse a number that is not a non-negative integer", () => {
    expect(() => formatCustomerNumber(1.5)).toThrow(RangeError);
    expect(() => formatCustomerNumber(-1)).toThrow(RangeError);
    expect(() => formatCustomerNumber(Number.NaN)).toThrow(RangeError);
  });
});
