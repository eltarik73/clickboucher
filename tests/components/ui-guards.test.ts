// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");
const UI_DIR = path.join(SRC, "components/ui");
const BRAND_DIR = path.join(SRC, "components/brand");
const COMPONENT_TESTS = path.join(ROOT, "tests/components");
const EXTENSIONS = [".tsx", ".ts"];

/**
 * Primitives livrées par C1-SOCLE-UI qu'aucune page n'importe encore, avec le chantier qui doit les adopter.
 * Une primitive sort de cette liste dès qu'elle gagne un importeur ; aucune autre ne peut y entrer.
 */
const AWAITING_ADOPTION: Record<string, string> = {
  "src/components/ui/sheet.tsx": "C2-PARCOURS-COMMANDE (panier, choix du poids)",
  "src/components/ui/form-field.tsx": "C2-PARCOURS-COMMANDE (formulaire invité)",
  "src/components/ui/price.tsx": "C2-VITRINE (prix des fiches produit)",
  "src/components/ui/heading.tsx": "C2-CLIENT (titres des pages client ; importé aujourd'hui par empty-state seul)",
  "src/components/ui/empty-state.tsx": "C2-CLIENT (panier, favoris, commandes vides)",
  "src/components/ui/status-badge.tsx": "C2-PARCOURS-COMMANDE (statut de commande au suivi)",
};

/** Nombre d'éléments <Switch> sans nom accessible hors de src/components/ui. Il ne peut que baisser. */
const UNLABELLED_SWITCH_BASELINE = 16;

const DELETED_PRIMITIVES = ["Toast.tsx", "quick-actions.tsx", "toggle-pill.tsx", "stepper.tsx", "skeleton.tsx"];

const REBUILT_FILES = [
  "src/components/ui/button.tsx",
  "src/components/ui/icon-button.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/form-field.tsx",
  "src/components/ui/switch.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/alert-dialog.tsx",
  "src/components/ui/ConfirmDialog.tsx",
  "src/components/ui/price.tsx",
  "src/components/ui/heading.tsx",
  "src/components/ui/empty-state.tsx",
  "src/components/ui/status-badge.tsx",
  "src/components/ui/ThemeToggle.tsx",
  "src/components/ui/toaster.tsx",
  "src/components/brand/BrandLogo.tsx",
];

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return EXTENSIONS.includes(path.extname(full)) ? [full] : [];
  });
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/** Fichiers source d'une primitive, chemin sans extension → chemin relatif au dépôt. */
const PRIMITIVES = [...walk(UI_DIR), ...walk(BRAND_DIR)];

function withoutExtension(file: string): string {
  return file.replace(/\.(tsx|ts)$/, "");
}

const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

/** Chemins absolus (sans extension) importés par un fichier : alias @/ et chemins relatifs seulement. */
function importedPaths(file: string): string[] {
  const out: string[] = [];
  for (const match of read(file).matchAll(IMPORT_PATTERN)) {
    const spec = match[1];
    let target: string | null = null;
    if (spec.startsWith("@/")) target = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) target = path.resolve(path.dirname(file), spec);
    if (target) out.push(withoutExtension(target), path.join(target, "index"));
  }
  return out;
}

function importersOf(primitive: string, files: string[]): string[] {
  const key = withoutExtension(primitive);
  return files.filter((file) => file !== primitive && importedPaths(file).includes(key));
}

/** Littéral de chaîne (guillemets, apostrophes ou gabarit) qui contient la position donnée. */
function enclosingLiteral(text: string, index: number): string {
  let start = index;
  while (start > 0 && !`"'\``.includes(text[start - 1])) start -= 1;
  const quote = text[start - 1];
  let end = index;
  while (end < text.length && text[end] !== quote) end += 1;
  return text.slice(start, end);
}

/** Balises ouvrantes <Switch …> complètes, accolades et chaînes comprises (un `=>` ne les coupe pas). */
function switchTags(text: string): string[] {
  const tags: string[] = [];
  for (const match of text.matchAll(/<Switch\b/g)) {
    let depth = 0;
    let quote: string | null = null;
    let i = match.index ?? 0;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) break;
    }
    tags.push(text.slice(match.index, i + 1));
  }
  return tags;
}

describe("garde-fous des primitives d'interface", () => {
  it("chaque outline-none est focus-visible:outline-none et s'accompagne de focus-visible:ring-2", () => {
    const offenders: string[] = [];
    for (const file of PRIMITIVES) {
      const text = read(file);
      for (const match of text.matchAll(/outline-none/g)) {
        const index = match.index ?? 0;
        const prefixed = text.slice(Math.max(0, index - "focus-visible:".length), index) === "focus-visible:";
        const literal = enclosingLiteral(text, index);
        if (!prefixed || !literal.includes("focus-visible:ring-2")) {
          offenders.push(`${rel(file)} : « ${literal.trim().slice(0, 120)} »`);
        }
      }
    }
    expect(offenders, "outline-none sans anneau de focus visible").toEqual([]);
  });

  it("les seules primitives sans importeur sont celles qui attendent leur adoption", () => {
    const sources = walk(SRC);
    const awaiting = new Set(Object.keys(AWAITING_ADOPTION));
    const withoutImporter = PRIMITIVES.filter((primitive) => {
      const importers = importersOf(primitive, sources).filter((file) => !awaiting.has(rel(file)));
      return importers.length === 0;
    }).map(rel);
    expect(withoutImporter.sort(), "primitive sans importeur hors liste, ou primitive adoptée encore listée").toEqual(
      [...awaiting].sort(),
    );
  });

  it("chaque primitive en attente d'adoption est importée par un test de tests/components", () => {
    const tests = walk(COMPONENT_TESTS);
    const untested = Object.keys(AWAITING_ADOPTION).filter(
      (primitive) => importersOf(path.join(ROOT, primitive), tests).length === 0,
    );
    expect(untested, "primitive en attente sans test").toEqual([]);
  });

  it("les primitives supprimées ne reviennent pas", () => {
    const present = DELETED_PRIMITIVES.filter((name) => existsSync(path.join(UI_DIR, name)));
    expect(present, "primitive supprimée de nouveau présente dans src/components/ui").toEqual([]);
  });

  it(`au plus ${UNLABELLED_SWITCH_BASELINE} <Switch> sans nom accessible hors de src/components/ui`, () => {
    const unlabelled: string[] = [];
    for (const file of walk(SRC)) {
      if (file.startsWith(UI_DIR + path.sep)) continue;
      for (const tag of switchTags(read(file))) {
        if (!/\baria-label(?:ledby)?\s*=/.test(tag)) unlabelled.push(rel(file));
      }
    }
    expect(
      unlabelled.length,
      `<Switch> sans aria-label ni aria-labelledby (utiliser SwitchField) :\n${unlabelled.join("\n")}`,
    ).toBeLessThanOrEqual(UNLABELLED_SWITCH_BASELINE);
  });

  it("les fichiers reconstruits existent, n'ont aucune couleur littérale et restent sous 300 lignes", () => {
    const problems: string[] = [];
    for (const file of REBUILT_FILES) {
      const full = path.join(ROOT, file);
      if (!existsSync(full)) {
        problems.push(`${file} : fichier absent`);
        continue;
      }
      const text = read(full);
      const literal = text.match(/[\w:-]*-\[#[^\]]*\]/);
      if (literal) problems.push(`${file} : classe à couleur littérale ${literal[0]}`);
      const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
      if (lines > 300) problems.push(`${file} : ${lines} lignes (maximum 300)`);
    }
    expect(problems).toEqual([]);
  });
});
