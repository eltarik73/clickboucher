// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LAYOUT = readFileSync(path.resolve(__dirname, "../../src/app/layout.tsx"), "utf8");

function openingTag(tag: string): string {
  const match = LAYOUT.match(new RegExp(`<${tag}\\b[^>]*>`));
  if (!match) throw new Error(`<${tag}> introuvable dans layout.tsx`);
  return match[0];
}

function fontOptions(loader: string): string {
  const match = LAYOUT.match(new RegExp(`\\b${loader}\\(\\{([\\s\\S]*?)\\}\\)`));
  if (!match) throw new Error(`${loader}({…}) introuvable dans layout.tsx`);
  return match[1];
}

describe("polices next/font du layout racine", () => {
  it("les trois variables de police sont posées sur <html>", () => {
    const html = openingTag("html");
    expect(html).toContain("dmSans.variable");
    expect(html).toContain("outfit.variable");
    expect(html).toContain("cormorant.variable");
  });

  it("<body> ne porte plus aucune variable de police", () => {
    expect(openingTag("body")).not.toContain(".variable");
  });

  it.each(["DM_Sans", "Outfit"])("%s est chargée en police variable (aucune option weight)", (loader) => {
    expect(fontOptions(loader)).not.toMatch(/\bweight\s*:/);
  });

  it("Cormorant Garamond charge 400 et 700, romain et italique", () => {
    const options = fontOptions("Cormorant_Garamond");
    const weight = options.match(/\bweight\s*:\s*\[([^\]]*)\]/)?.[1] ?? "";
    const style = options.match(/\bstyle\s*:\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(weight).toMatch(/"400"/);
    expect(weight).toMatch(/"700"/);
    expect(style).toMatch(/"normal"/);
    expect(style).toMatch(/"italic"/);
    expect(options).toMatch(/\bpreload\s*:\s*false/);
  });
});
