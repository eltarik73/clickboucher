// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import tailwindcss from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";
import config from "../../tailwind.config";

const GLOBALS = path.resolve(__dirname, "../../src/styles/globals.css");

let root: Root;

beforeAll(async () => {
  const result = await postcss([tailwindcss(config)]).process(readFileSync(GLOBALS, "utf8"), {
    from: GLOBALS,
  });
  root = result.root;
}, 60_000);

function rulesFor(selector: string): Rule[] {
  const rules: Rule[] = [];
  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) rules.push(rule);
  });
  return rules;
}

function declValue(rule: Rule, prop: string): string | undefined {
  let value: string | undefined;
  rule.walkDecls(prop, (decl) => {
    value = decl.value;
  });
  return value;
}

describe("feuille de style compilée (globals.css + tailwind.config.ts)", () => {
  // Tailwind 3 réémet les keyframes à côté de chaque utilitaire qui les utilise
  // (animate-pulse-soft et animate-pulse-slow, animate-slide-up et animate-[slideUp_…]) :
  // un nom peut donc apparaître deux fois, mais jamais avec deux corps différents.
  it("chaque @keyframes n'a qu'une définition", () => {
    const bodies = new Map<string, Set<string>>();
    root.walkAtRules("keyframes", (rule) => {
      const body = rule.nodes?.map((node) => node.toString().replace(/\s+/g, " ")).join("|") ?? "";
      bodies.set(rule.params, (bodies.get(rule.params) ?? new Set()).add(body));
    });
    const conflicting = [...bodies].filter(([, set]) => set.size > 1).map(([name]) => name);
    expect(bodies.size).toBeGreaterThan(0);
    expect(conflicting).toEqual([]);
  });

  it("globals.css ne définit que les keyframes flashGreen et flashRed", () => {
    const source = postcss.parse(readFileSync(GLOBALS, "utf8"));
    const names: string[] = [];
    source.walkAtRules("keyframes", (rule) => {
      names.push(rule.params);
    });
    expect(names).toEqual(["flashGreen", "flashRed"]);
  });

  // Les variantes motion-safe: des primitives émettent des blocs « no-preference » : seul
  // le filet « reduce » est unique.
  it("un seul bloc prefers-reduced-motion: reduce, qui coupe toute animation sauf animate-spin", () => {
    const blocks: AtRule[] = [];
    root.walkAtRules("media", (rule) => {
      if (/prefers-reduced-motion:\s*reduce/.test(rule.params)) blocks.push(rule);
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].toString()).toContain('[class*="animate-"]:not([class*="animate-spin"])');
  });

  it(".font-display est défini une seule fois", () => {
    expect(rulesFor(".font-display")).toHaveLength(1);
  });

  it.each([
    [".animate-fade-in", "fade-in 0.35s ease both"],
    [".animate-fade-up", "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both"],
    [".animate-scale-in", "scale-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both"],
    [".animate-slide-up", "slideUp 0.4s ease-out"],
  ])("%s est défini une fois avec la valeur de référence", (selector, animation) => {
    const rules = rulesFor(selector);
    expect(rules).toHaveLength(1);
    expect(declValue(rules[0], "animation")).toBe(animation);
  });

  it.each([".bg-indigo-500\\/10", ".bg-green-500\\/10", ".bg-orange-500\\/10", ".bg-gray-400\\/10"])(
    "la classe de statut %s de src/lib est émise",
    (selector) => {
      expect(rulesFor(selector).length).toBeGreaterThan(0);
    },
  );

  it("aucune règle body ne pose de font-family", () => {
    const offenders = rulesFor("body").filter((rule) => declValue(rule, "font-family") !== undefined);
    expect(offenders.map((rule) => rule.toString())).toEqual([]);
  });

  it("la pile de police de <html> commence par la variable next/font", () => {
    const families = rulesFor("html")
      .map((rule) => declValue(rule, "font-family"))
      .filter((value): value is string => value !== undefined);
    expect(families).toHaveLength(1);
    expect(families[0].startsWith("var(--font-body)")).toBe(true);
  });
});
