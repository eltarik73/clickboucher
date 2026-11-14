// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../../tailwind.config";
import { SOLID_PAIRS, SUBTLE_PAIRS, SURFACE_TOKENS, TEXT_TOKENS } from "@/lib/design-tokens";

const CSS = readFileSync(path.resolve(__dirname, "../../styles/globals.css"), "utf8");
const HSL_TRIPLET = /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/;

type Vars = Record<string, string>;

/** Règles de premier niveau du fichier (hors @media / @supports), commentaires retirés. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Array<{ selector: string; body: string }> = [];
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") {
      if (depth === 0) {
        selector = source.slice(start, i).trim();
        start = i + 1;
      }
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        rules.push({ selector, body: source.slice(start, i) });
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      start = i + 1;
    }
  }
  return rules;
}

function customProperties(selector: string): Vars {
  const vars: Vars = {};
  for (const rule of topLevelRules(CSS)) {
    if (rule.selector !== selector) continue;
    for (const match of rule.body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      vars[match[1]] = match[2].trim();
    }
  }
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

function luminance(triplet: string): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hslToRgb(triplet).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
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

  it.each(["light", "dark"] as const)("thème %s : chaque token est défini en 'H S% L%', sans alpha", (theme) => {
    const invalid = referenced
      .filter((name) => !HSL_TRIPLET.test(THEMES[theme][name] ?? ""))
      .map((name) => `--${name}: ${THEMES[theme][name] ?? "(absent)"}`);
    expect(invalid).toEqual([]);
  });

  it.each(["light", "dark"] as const)("thème %s : --primary vaut #dc2626", (theme) => {
    expect(toHex(THEMES[theme].primary)).toBe("#dc2626");
  });

  it.each(["light", "dark"] as const)("thème %s : toutes les paires atteignent leur seuil WCAG", (theme) => {
    const vars = THEMES[theme];
    const failures: string[] = [];
    const check = (fg: string, bg: string, min: number) => {
      const ratio = contrast(vars[fg], vars[bg]);
      if (!(ratio >= min)) failures.push(`${fg} sur ${bg} = ${ratio.toFixed(2)} (< ${min})`);
    };
    for (const text of TEXT_TOKENS) for (const surface of SURFACE_TOKENS) check(text, surface, 4.5);
    for (const [text, surface] of SUBTLE_PAIRS) check(text, surface, 4.5);
    for (const [text, surface] of SOLID_PAIRS) check(text, surface, 4.5);
    for (const surface of SURFACE_TOKENS) {
      check("ring", surface, 3);
      check("primary", surface, 3);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("les variables héritées ont disparu", () => {
    for (const legacy of ["--burgundy", "--orange", "--radius-sm", "--radius-xs", "-stack"]) {
      expect(CSS).not.toContain(legacy);
    }
  });
});
