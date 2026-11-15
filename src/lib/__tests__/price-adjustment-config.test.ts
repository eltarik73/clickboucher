// @vitest-environment node
//
// The safety cap of one price adjustment as platform_config stores it (a string): one rule, a whole
// percentage from 1 to 100, for the webmaster's write and for the server's read.
import { describe, expect, it } from "vitest";
import { parseMaxIncreasePct } from "@/lib/price-adjustment-config";

describe("parseMaxIncreasePct", () => {
  it.each([
    ["1", 1],
    ["30", 30],
    ["100", 100],
  ])("reads the stored cap %j as %i", (stored, cap) => {
    expect(parseMaxIncreasePct(stored)).toEqual({ success: true, data: cap });
  });

  it.each([
    ["", "Le plafond est d'au moins 1 %"],
    ["0", "Le plafond est d'au moins 1 %"],
    ["-5", "Le plafond est d'au moins 1 %"],
    ["101", "Le plafond est d'au plus 100 %"],
    ["900", "Le plafond est d'au plus 100 %"],
    ["12.5", "Le plafond est un nombre entier de pourcents"],
    ["abc", "Le plafond est un nombre de pourcents"],
  ])("refuses the stored cap %j: %s", (stored, message) => {
    const parsed = parseMaxIncreasePct(stored);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.message)).toEqual([message]);
  });
});
