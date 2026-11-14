#!/usr/bin/env node
/**
 * Audit statique des tests de Klik&Go (lecture seule, aucune dépendance).
 *
 * Usage, DEPUIS LA RACINE DU DÉPÔT (le script lit ./src et ./tests du dossier courant) :
 *   node .claude/skills/testing-strategy/scripts/audit-tests.mjs            # rapport
 *   node .claude/skills/testing-strategy/scripts/audit-tests.mjs --strict   # code de sortie 1 s'il reste une erreur
 * Code de sortie 2 : lancé ailleurs qu'à la racine (ni src/ ni tests/).
 *
 * Ce que le script cherche, et pourquoi (voir SKILL.md, « Règles ») :
 *   ERREUR  test-d-une-copie   un fichier Vitest qui n'importe aucun code du produit teste du code recopié (règle 1)
 *   ERREUR  only               `.only(` oublié : le reste de la suite ne tourne plus
 *   ERREUR  attente-fixe       `waitForTimeout(` dans une spec Playwright (règle 7)
 *   ALERTE  prisma-simule      `vi.mock("@/lib/prisma")` : interdit par CLAUDE.md pour tout nouveau test (règle 3) ;
 *                              les fichiers hérités restent signalés jusqu'à leur migration en intégration
 *   ALERTE  skip               `.skip(` / `.fixme(` / `.todo(` : dette à dater
 *   ALERTE  selecteur-fragile  `locator("...")` CSS/XPath, `.first()`, `.last()`, `.nth(` dans une spec Playwright (règle 8) ;
 *                              exception : `.first()).toBeVisible(`, idiome documenté de « au moins un visible »
 *   ALERTE  assertion-manuelle `expect(await x.isVisible())` et consorts : pas de ré-essai automatique (règle 7)
 *   ALERTE  url-absolue        `goto("https://…")` : contourne baseURL, donc la garde anti-production (règle 9)
 *   ALERTE  horloge-reelle     `Date.now()` / `new Date()` sans horloge simulée dans un test Vitest (règle 6)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", "coverage", "playwright-report", "test-results"]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "tests"))];
if (files.length === 0) {
  process.stderr.write("Ni src/ ni tests/ dans le dossier courant : lancer le script depuis la racine du dépôt.\n");
  process.exit(2);
}
const vitestFiles = files.filter((f) => /\.test\.tsx?$/.test(f));
const playwrightFiles = files.filter((f) => /\.(spec|setup)\.ts$/.test(f) && f.includes(`${join("tests", "e2e")}`));

const findings = [];
const add = (level, rule, file, detail) => findings.push({ level, rule, file: relative(ROOT, file), detail });

/** Retire commentaires de ligne et de bloc pour éviter les faux positifs. */
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const count = (source, regex) => (source.match(regex) ?? []).length;
const lineOf = (source, regex) => {
  const index = source.search(regex);
  return index < 0 ? 0 : source.slice(0, index).split("\n").length;
};

let vitestTests = 0;
let copiedTests = 0;

for (const file of vitestFiles) {
  const raw = readFileSync(file, "utf8");
  const code = strip(raw);
  const tests = count(code, /^\s*(?:it|test)(?:\.each\([^)]*\))?\(/gm);
  vitestTests += tests;

  const importsProduct =
    /from\s+["']@\//.test(code) ||
    /import\(\s*["']@\//.test(code) ||
    /from\s+["']\.\.?\/(?!.*\.test)/.test(code) ||
    /readFileSync\(/.test(code); // tests de structure qui lisent les sources (ex. middleware-matcher)
  if (!importsProduct) {
    copiedTests += tests;
    add("ERREUR", "test-d-une-copie", file, `${tests} test(s) sans aucun import du produit`);
  }
  if (/\b(?:it|test|describe)\.only\(/.test(code)) add("ERREUR", "only", file, `ligne ${lineOf(raw, /\.only\(/)}`);
  if (/vi\.mock\(\s*["']@\/lib\/prisma["']/.test(code)) add("ALERTE", "prisma-simule", file, `${tests} test(s) sur un Prisma simulé (interdit par CLAUDE.md)`);
  const skips = count(code, /\b(?:it|test|describe)\.(?:skip|todo|fixme)\(/g);
  if (skips) add("ALERTE", "skip", file, `${skips} occurrence(s)`);
  // En intégration, des dates relatives à l'heure réelle (« créée il y a 10 min ») sont légitimes :
  // le code serveur lit lui-même l'horloge. La règle ne vise que les tests unitaires.
  const isIntegration = file.includes(join("tests", "integration"));
  const usesClock = /useFakeTimers|setSystemTime/.test(code);
  const realClock = count(code, /\bDate\.now\(\)|new Date\(\s*\)/g);
  if (realClock && !usesClock && !isIntegration) add("ALERTE", "horloge-reelle", file, `${realClock} lecture(s) de l'heure réelle`);
}

let e2eTests = 0;
for (const file of playwrightFiles) {
  const raw = readFileSync(file, "utf8");
  const code = strip(raw);
  e2eTests += count(code, /^\s*(?:test|setup)(?:\.(?:only|skip|fixme|fail|slow))?\(/gm);
  if (/\b(?:test|describe)\.only\(/.test(code)) add("ERREUR", "only", file, `ligne ${lineOf(raw, /\.only\(/)}`);
  const sleeps = count(code, /waitForTimeout\(/g);
  if (sleeps) add("ERREUR", "attente-fixe", file, `${sleeps} waitForTimeout`);
  const css = count(code, /\.locator\(\s*["'`]/g);
  const positional = count(code, /\.(?:first|last)\(\)(?!\)\.toBeVisible\()|\.nth\(/g);
  if (css || positional) add("ALERTE", "selecteur-fragile", file, `${css} locator CSS/XPath, ${positional} first/last/nth`);
  // `expect(await prisma.x.count(...))` est une lecture en base, pas une assertion d'interface : hors règle.
  const manual = count(code, /expect\(\s*await\s+(?!prisma\.)[^;\n]*?\.(?:isVisible|isEnabled|isChecked|textContent|innerText|count)\(/g);
  if (manual) add("ALERTE", "assertion-manuelle", file, `${manual} occurrence(s)`);
  const absolute = count(code, /\.goto\(\s*["'`]https?:\/\//g);
  if (absolute) add("ALERTE", "url-absolue", file, `${absolute} occurrence(s)`);
  const skips = count(code, /\btest\.(?:skip|fixme)\(/g);
  if (skips) add("ALERTE", "skip", file, `${skips} occurrence(s)`);
}

const integrationFiles = vitestFiles.filter((f) => f.includes(join("tests", "integration")));
const errors = findings.filter((f) => f.level === "ERREUR");
const warnings = findings.filter((f) => f.level === "ALERTE");

const out = [];
out.push("Audit des tests — Klik&Go");
out.push(`  Fichiers Vitest        : ${vitestFiles.length} (${vitestTests} tests déclarés)`);
out.push(`  dont intégration réelle : ${integrationFiles.length} fichier(s) sous tests/integration/`);
out.push(`  Specs Playwright       : ${playwrightFiles.length} (${e2eTests} tests déclarés)`);
out.push(`  Tests d'une copie      : ${copiedTests} (${vitestTests ? Math.round((copiedTests / vitestTests) * 100) : 0} % des tests Vitest)`);
out.push("");
for (const group of [errors, warnings]) {
  for (const f of group) out.push(`${f.level.padEnd(6)} ${f.rule.padEnd(20)} ${f.file} — ${f.detail}`);
}
out.push("");
out.push(`${errors.length} erreur(s), ${warnings.length} alerte(s).`);
process.stdout.write(out.join("\n") + "\n");
process.exit(STRICT && errors.length ? 1 : 0);
