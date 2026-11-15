// @vitest-environment node
// Lasting rules of the UI primitives, read from the shipped sources: a keyboard focus ring wherever
// the outline is removed, colours from the tokens, a name on every switch, one logo, one badge.
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "../lib/source-files";

const ROOT = path.resolve(__dirname, "../..");
const UI_DIR = "src/components/ui";
const UI_FILES = sourceFiles(UI_DIR);
const SRC_FILES = sourceFiles("src");

const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const filesContaining = (files: string[], test: (text: string) => boolean) =>
  files.filter((file) => test(read(file))).sort();

/** Unlabelled <Switch> elements outside src/components/ui. The count may only go down. */
const UNLABELLED_SWITCH_BASELINE = 16;

/** Primitives still on literal colours; a file leaves the list when it moves to the tokens. */
const LITERAL_COLOUR_FILES = [
  "src/components/ui/FavoriteButton.tsx",
  "src/components/ui/FormWizard.tsx",
  "src/components/ui/NotificationBell.tsx",
  "src/components/ui/StarRating.tsx",
];

/** The K of the logo mark. */
const LOGO_GLYPH = "M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z";

/** A class string that removes the outline: the run of characters between two quotes. */
const OUTLINE_CLASSES = /[^"'`]*\boutline-none\b[^"'`]*/g;

/** A Tailwind arbitrary value holding a literal colour, such as bg-[#DC2626]. */
const LITERAL_COLOUR = /-\[(?:#|rgba?\(|hsla?\()/;

/** The tinted surface of a status tone, such as bg-success-subtle. */
const TONE_SURFACE = /\bbg-(info|success|warning|destructive)-subtle\b/g;

// The outline may go only on keyboard focus, and only when a ring is drawn instead.
const hasFocusRing = (classes: string[]) =>
  classes.includes("focus-visible:ring-2") &&
  classes.every((name) => !name.endsWith("outline-none") || name === "focus-visible:outline-none");

/** <Switch> elements without aria-label or aria-labelledby, found by the TypeScript parser. */
function unlabelledSwitches(file: string): number {
  const text = read(file);
  if (!text.includes("<Switch")) return 0;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  let count = 0;
  const visit = (node: ts.Node): void => {
    const element = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
    if (element && node.tagName.getText(source) === "Switch") {
      const names = node.attributes.properties.map((attribute) =>
        ts.isJsxAttribute(attribute) ? attribute.name.getText(source) : ""
      );
      if (!names.includes("aria-label") && !names.includes("aria-labelledby")) count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

describe("garde-fous des primitives d'interface", () => {
  it("outline-none ne s'écrit que focus-visible:outline-none, avec focus-visible:ring-2", () => {
    const offenders = UI_FILES.flatMap((file) =>
      (read(file).match(OUTLINE_CLASSES) ?? [])
        .map((classes) => classes.trim())
        .filter((classes) => !hasFocusRing(classes.split(/\s+/)))
        .map((classes) => `${file} : « ${classes} »`)
    );
    expect(offenders).toEqual([]);
  });

  it("aucune couleur littérale hors des primitives qui attendent les tokens", () => {
    const literal = filesContaining(UI_FILES, (text) => LITERAL_COLOUR.test(text));
    expect(literal).toEqual(LITERAL_COLOUR_FILES);
  });

  it(`au plus ${UNLABELLED_SWITCH_BASELINE} <Switch> sans nom accessible hors de ${UI_DIR}`, () => {
    const counts = SRC_FILES.filter((file) => !file.startsWith(`${UI_DIR}/`))
      .map((file) => [file, unlabelledSwitches(file)] as const)
      .filter(([, count]) => count > 0);
    const total = counts.reduce((sum, [, count]) => sum + count, 0);
    expect(total, counts.join("\n")).toBeLessThanOrEqual(UNLABELLED_SWITCH_BASELINE);
  });

  // SplashScreen and the HTML of the printed ticket still draw the mark by hand.
  it("le K du logo n'est dessiné que par KlikLogo et les deux copies connues", () => {
    expect(filesContaining(SRC_FILES, (text) => text.includes(LOGO_GLYPH))).toEqual([
      "src/components/SplashScreen.tsx",
      "src/components/boucher/OrderTicket.tsx",
      "src/components/ui/KlikLogo.tsx",
    ]);
  });

  it("seul badge.tsx porte les teintes de plusieurs statuts", () => {
    const tones = (text: string) => new Set(Array.from(text.matchAll(TONE_SURFACE), ([, t]) => t));
    const toneTables = filesContaining(UI_FILES, (text) => tones(text).size > 1);
    expect(toneTables).toEqual(["src/components/ui/badge.tsx"]);
  });
});
