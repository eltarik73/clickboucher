#!/usr/bin/env node
// Mesure le coût des portes qualité candidates, sans rien écrire dans le dépôt.
// À lancer depuis la racine du dépôt :
//   node .claude/skills/quality-gates/scripts/mesurer-portes.mjs [dossier de travail HORS dépôt] [--only=eslint,type,tsc]
// - eslint : configuration du dépôt, puis règles bon marché (any, variables inutilisées, directives
//   inutiles, console, process.env, complexité, profondeur, taille) — environ 40 s ;
// - type   : règles typées (promesses, switch, no-unsafe-*, conditions inutiles…) — 1 à 2 min ;
// - tsc    : chaque option de tsconfig au-delà de strict, une à la fois — environ 30 s par option.
// Les configurations d'essai, les sorties JSON et resume.txt vont dans le dossier de travail.
// Jamais de --fix, jamais de cache, tsc en incremental false : l'arbre du dépôt n'est pas touché.
// Codes de sortie : 0 = mesures faites ; 2 = impossible de mesurer (mauvais dossier, outil absent,
// dossier de travail dans le dépôt, ESLint ou tsc en panne) — jamais un faux « 0 constat ».
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const work = args.find((a) => !a.startsWith("--"));
const onlyArg = args.find((a) => a.startsWith("--only="));
const steps = new Set((onlyArg ? onlyArg.slice(7) : "eslint,type,tsc").split(","));

function stop(message) {
  console.error(`mesurer-portes : ${message}`);
  process.exit(2);
}

const eslintBin = path.join(root, "node_modules", "eslint", "bin", "eslint.js");
const tscBin = path.join(root, "node_modules", "typescript", "bin", "tsc");
for (const f of [".eslintrc.json", "tsconfig.json", "src"].map((p) => path.join(root, p)).concat(eslintBin, tscBin)) {
  if (!existsSync(f)) stop(`${f} introuvable : lancer depuis la racine du dépôt, dépendances installées.`);
}
if (!work) stop("indiquer un dossier de travail hors du dépôt (ex. le dossier de travail du chantier).");
const out = path.resolve(work);
const rel = path.relative(root, out);
if (!rel.startsWith("..") && !path.isAbsolute(rel)) stop(`le dossier de travail ${out} est dans le dépôt : refusé.`);
mkdirSync(out, { recursive: true });

const ZONES = [
  "src/lib/services/orders", "src/lib/pricing", "src/lib/auth", "src/lib/__tests__", "src/lib",
  "src/app/api", "src/app", "src/components", "src/hooks", "src",
];
const zoneOf = (f) => ZONES.find((z) => f === z || f.startsWith(`${z}/`)) ?? "hors src";

const CHEAP_RULES = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": ["error", {
    argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true,
  }],
  "no-console": ["warn", { allow: ["warn", "error"] }],
  "no-restricted-syntax": ["warn", {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message: "Lire les variables par le module d'environnement validé.",
  }],
  complexity: ["warn", 15],
  "max-depth": ["warn", 4],
  "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
};
const TYPED_RULES = {
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": "error",
  "@typescript-eslint/await-thenable": "error",
  "@typescript-eslint/only-throw-error": "error",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "@typescript-eslint/no-unsafe-assignment": "warn",
  "@typescript-eslint/no-unsafe-member-access": "warn",
  "@typescript-eslint/no-unsafe-argument": "warn",
  "@typescript-eslint/no-unsafe-call": "warn",
  "@typescript-eslint/no-unsafe-return": "warn",
  "@typescript-eslint/no-unnecessary-condition": "warn",
  "@typescript-eslint/prefer-nullish-coalescing": "warn",
  "@typescript-eslint/no-non-null-assertion": "warn",
  "@typescript-eslint/no-unnecessary-type-assertion": "warn",
  "@typescript-eslint/no-deprecated": "warn",
  "@typescript-eslint/consistent-type-imports": "warn",
};
const TSC_FLAGS = [
  "noFallthroughCasesInSwitch", "noImplicitReturns", "noImplicitOverride", "noUnusedParameters",
  "noUnusedLocals", "exactOptionalPropertyTypes", "noUncheckedIndexedAccess",
  "noPropertyAccessFromIndexSignature",
];

const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };
const git = (gitArgs) => (spawnSync("git", gitArgs, { cwd: root, encoding: "utf8" }).stdout ?? "").trim();
const head = git(["rev-parse", "--short", "HEAD"]);
const dirty = git(["status", "--porcelain", "--", "src", "tests", "scripts", "prisma", "tsconfig.json", ".eslintrc.json"]);
say(`Mesure du ${new Date().toISOString().slice(0, 10)} — HEAD ${head || "?"}${dirty ? " + modifications non commitées dans le code" : ", code sans modification locale"}`);

function writeJson(name, value) {
  const file = path.join(out, name);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function lint(label, config, targets) {
  const cfg = writeJson(`essai-${label}.eslintrc.json`, config);
  const report = path.join(out, `eslint-${label}.json`);
  const t0 = Date.now();
  const run = spawnSync(process.execPath, [
    eslintBin, "--no-eslintrc", "-c", cfg, "--resolve-plugins-relative-to", root,
    "--ext", ".ts,.tsx", "-f", "json", "-o", report, ...targets,
  ], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.error || run.status === null || run.status >= 2 || !existsSync(report)) {
    stop(`ESLint (${label}) n'a pas pu tourner :\n${`${run.stdout}${run.stderr}`.split("\n").slice(0, 12).join("\n")}`);
  }
  const data = JSON.parse(readFileSync(report, "utf8"));
  const byRule = new Map();
  const byZone = new Map();
  for (const r of data) {
    const file = path.relative(root, r.filePath).split(path.sep).join("/");
    for (const m of r.messages) {
      if (m.fatal) stop(`ESLint (${label}) : erreur fatale dans ${file} : ${m.message}`);
      const id = (m.ruleId ?? "directive eslint-disable inutile") +
        (m.messageId === "voidReturnAttribute" ? " (attribut JSX)" : "");
      const e = byRule.get(id) ?? { n: 0, files: new Set() };
      e.n += 1; e.files.add(file); byRule.set(id, e);
      const zone = zoneOf(file);
      const z = byZone.get(zone) ?? new Map();
      z.set(id, (z.get(id) ?? 0) + 1); byZone.set(zone, z);
    }
  }
  say(`\n## ESLint — ${label} (${data.length} fichiers, ${Math.round((Date.now() - t0) / 1000)} s)`);
  if (byRule.size === 0) say("aucun signalement");
  for (const [id, e] of [...byRule].sort((a, b) => b[1].n - a[1].n)) {
    say(`${String(e.n).padStart(6)} dans ${String(e.files.size).padStart(4)} fichiers  ${id}`);
  }
  for (const zone of [...ZONES, "hors src"]) {
    const z = byZone.get(zone);
    if (!z) continue;
    const short = [...z].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k.replace("@typescript-eslint/", "ts/")}=${v}`).join(" ");
    say(`  ${zone.padEnd(24)} ${short}`);
  }
}

const base = { root: true, extends: [path.join(root, ".eslintrc.json")] };
if (steps.has("eslint")) {
  lint("depot", base, ["src"]);
  lint("bon-marche", { ...base, reportUnusedDisableDirectives: true, rules: CHEAP_RULES }, ["src"]);
  lint("bon-marche-tests-scripts", { ...base, rules: CHEAP_RULES }, ["tests", "scripts"]);
}
if (steps.has("type")) {
  lint("type", {
    ...base,
    parserOptions: { projectService: true, tsconfigRootDir: root },
    rules: TYPED_RULES,
  }, ["src"]);
}
if (steps.has("tsc")) {
  say("\n## tsc — une option à la fois (base : tsconfig.json du dépôt, incremental false)");
  for (const flag of ["(aucune)", ...TSC_FLAGS]) {
    const options = { incremental: false };
    if (flag !== "(aucune)") options[flag] = true;
    const cfg = writeJson(`tsconfig-${flag === "(aucune)" ? "base" : flag}.json`,
      { extends: path.join(root, "tsconfig.json"), compilerOptions: options });
    const run = spawnSync(process.execPath, [tscBin, "-p", cfg, "--noEmit"],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const text = `${run.stdout}${run.stderr}`;
    writeFileSync(path.join(out, `tsc-${flag === "(aucune)" ? "base" : flag}.txt`), text);
    // Le chemin s'arrête à « (ligne,colonne): error » : les groupes de routes comme (boucher)
    // contiennent eux aussi des parenthèses.
    const errorFiles = text.split("\n")
      .map((l) => /^(.+?)\(\d+,\d+\): error TS\d+:/.exec(l)?.[1])
      .filter(Boolean);
    if (run.status !== 0 && errorFiles.length === 0) stop(`tsc (${flag}) a échoué sans erreur de type :\n${text.slice(0, 800)}`);
    const zones = new Map();
    for (const f of errorFiles) zones.set(zoneOf(f), (zones.get(zoneOf(f)) ?? 0) + 1);
    const errors = errorFiles;
    const files = new Set(errorFiles).size;
    say(`${flag.padEnd(36)} ${String(errors.length).padStart(5)} erreurs dans ${String(files).padStart(4)} fichiers  ` +
      [...zones].sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z}=${n}`).join(" "));
  }
}
writeFileSync(path.join(out, "resume.txt"), `${lines.join("\n")}\n`);
console.log(`\nRésumé écrit dans ${path.join(out, "resume.txt")}`);
