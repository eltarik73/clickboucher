// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import config from "../../../tailwind.config";
import { contrastRatio } from "../../../tests/helpers/wcag-contrast";
import { SOLID_PAIRS, SUBTLE_PAIRS, SURFACE_TOKENS, TEXT_TOKENS } from "@/lib/design-tokens";

const CSS = postcss.parse(
  readFileSync(path.resolve(__dirname, "../../styles/globals.css"), "utf8")
);
const HSL_TRIPLET = /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/;

type Vars = Record<string, string>;

/** Custom properties of the rules written for exactly this selector, keyed without their --. */
function customProperties(selector: string): Vars {
  const vars: Vars = {};
  CSS.walkRules(selector, (rule) => {
    rule.walkDecls(/^--/, (decl) => {
      vars[decl.prop.slice(2)] = decl.value;
    });
  });
  return vars;
}

const LIGHT = customProperties(":root");
const THEMES: Record<"light" | "dark", Vars> = {
  light: LIGHT,
  dark: { ...LIGHT, ...customProperties(".dark") },
};

function hslToRgb(triplet: string): [number, number, number] {
  const [h, s, l] = triplet.split(" ").map((part) => parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number];
}

function toHex(triplet: string): string {
  return `#${hslToRgb(triplet)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function referencedColorVariables(): string[] {
  const names = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/hsl\(var\(--([\w-]+)\)/g)) names.add(match[1]);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(config.theme?.extend?.colors);
  return [...names].sort();
}

describe("tokens de couleur de globals.css", () => {
  const referenced = referencedColorVariables();

  it("la config Tailwind référence des tokens de couleur", () => {
    expect(referenced.length).toBeGreaterThan(20);
  });

  it.each(["light", "dark"] as const)(
    "thème %s : chaque token est défini en 'H S% L%', sans alpha",
    (theme) => {
      const invalid = referenced
        .filter((name) => !HSL_TRIPLET.test(THEMES[theme][name] ?? ""))
        .map((name) => `--${name}: ${THEMES[theme][name] ?? "(absent)"}`);
      expect(invalid).toEqual([]);
    }
  );

  it.each(["light", "dark"] as const)("thème %s : --primary vaut #dc2626", (theme) => {
    expect(toHex(THEMES[theme].primary)).toBe("#dc2626");
  });

  // Anchors of the formula: black on white is 21:1; white on #dc2626 is 1.05 / 0.2174 ≈ 4.83:1.
  it("le ratio WCAG vaut 21 pour noir sur blanc et 4,83 pour blanc sur #dc2626", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBe(21);
    expect(contrastRatio([255, 255, 255], [220, 38, 38])).toBeCloseTo(4.83, 2);
  });

  it.each(["light", "dark"] as const)(
    "thème %s : toutes les paires atteignent leur seuil WCAG",
    (theme) => {
      const vars = THEMES[theme];
      const failures: string[] = [];
      const check = (fg: string, bg: string, min: number) => {
        const ratio = contrastRatio(hslToRgb(vars[fg]), hslToRgb(vars[bg]));
        if (!(ratio >= min)) failures.push(`${fg} sur ${bg} = ${ratio.toFixed(2)} (< ${min})`);
      };
      for (const text of TEXT_TOKENS)
        for (const surface of SURFACE_TOKENS) check(text, surface, 4.5);
      for (const [text, surface] of SUBTLE_PAIRS) check(text, surface, 4.5);
      for (const [text, surface] of SOLID_PAIRS) check(text, surface, 4.5);
      for (const surface of SURFACE_TOKENS) {
        check("ring", surface, 3);
        check("primary", surface, 3);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    }
  );
});
