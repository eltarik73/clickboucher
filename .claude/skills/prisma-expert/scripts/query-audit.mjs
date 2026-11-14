#!/usr/bin/env node
/**
 * query-audit.mjs — audit statique (lecture seule) des appels Prisma dans src/.
 *
 * Usage (depuis la racine du dépôt) :
 *   node .claude/skills/prisma-expert/scripts/query-audit.mjs [racine] [--max-unbounded=N] [--quiet]
 *
 * Ne se connecte à aucune base, ne modifie rien. Signale :
 *   UNBOUNDED  findMany sans `take` dans ses arguments. Marqué « borné par in » quand le where
 *              filtre par une liste (`in:`) : la taille dépend alors de l'appelant, à vérifier.
 *   LOOP       `await prisma.…` ou `await tx.…` écrit dans le corps d'un for / while
 *              (candidat N+1 : une requête par tour).
 *   OFFSET     pagination `skip: (page - 1) * …` (coût proportionnel au décalage).
 *   NEW-CLIENT `new PrismaClient(` ailleurs que dans src/lib/prisma.ts.
 *   RAW-UNSAFE `$queryRawUnsafe` / `$executeRawUnsafe` (injection SQL si une valeur est concaténée).
 *
 * Code de sortie : 0 par défaut ; 1 si --max-unbounded=N est fourni et que le nombre de
 * findMany sans take ni `in:` dépasse N (cliquet : on fixe N à la valeur du jour, puis on la baisse).
 * Heuristiques lexicales : un constat est une invitation à lire le code, pas une preuve.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const quiet = args.includes("--quiet");
const maxArg = args.find((a) => a.startsWith("--max-unbounded="));
const maxUnbounded = maxArg ? Number(maxArg.split("=")[1]) : null;
const ROOT = resolve(args.find((a) => !a.startsWith("--")) ?? process.cwd());
const SRC = join(ROOT, "src");
if (!existsSync(SRC)) {
  console.error(`dossier src introuvable sous ${ROOT}\nLancer depuis la racine du dépôt ou passer la racine en argument.`);
  process.exit(2);
}
const rel = (p) => relative(ROOT, p).split(sep).join("/");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Renvoie le texte entre la parenthèse ouvrante située à `open` et sa fermante. */
function balanced(src, open, openCh = "(", closeCh = ")") {
  let depth = 1;
  let i = open + 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === openCh) depth++;
    else if (c === closeCh) depth--;
    i++;
  }
  return src.slice(open + 1, i - 1);
}
const lineOf = (src, index) => src.slice(0, index).split("\n").length;

const findings = { UNBOUNDED: [], "UNBOUNDED-IN": [], LOOP: [], OFFSET: [], "NEW-CLIENT": [], "RAW-UNSAFE": [] };
let totalFindMany = 0;

for (const file of walk(SRC)) {
  const src = readFileSync(file, "utf8");
  const where = rel(file);

  for (const m of src.matchAll(/\.findMany\s*\(/g)) {
    totalFindMany++;
    const argText = balanced(src, m.index + m[0].length - 1);
    if (/\btake\s*:/.test(argText) || /\btake\b\s*[,}]/.test(argText)) continue;
    const entry = `${where}:${lineOf(src, m.index)}`;
    if (/\bin\s*:/.test(argText)) findings["UNBOUNDED-IN"].push(entry);
    else findings.UNBOUNDED.push(`${entry}${/\bwhere\b/.test(argText) ? "" : "  (aucun where)"}`);
  }

  for (const m of src.matchAll(/\b(?:for\s*(?:await\s*)?\([^)]*\)|while\s*\([^)]*\))\s*\{/g)) {
    const body = balanced(src, m.index + m[0].length - 1, "{", "}");
    const calls = [...new Set((body.match(/await\s+(?:prisma|tx)\.\w+\.\w+/g) ?? []).map((c) => c.replace(/await\s+/, "")))];
    if (calls.length > 0) findings.LOOP.push(`${where}:${lineOf(src, m.index)}  ${calls.join(", ")}`);
  }

  for (const m of src.matchAll(/skip\s*:\s*\(\s*(?:\w+\.)?page\s*-\s*1\s*\)/g)) findings.OFFSET.push(`${where}:${lineOf(src, m.index)}`);
  if (where !== "src/lib/prisma.ts") {
    for (const m of src.matchAll(/new\s+PrismaClient\s*\(/g)) findings["NEW-CLIENT"].push(`${where}:${lineOf(src, m.index)}`);
  }
  for (const m of src.matchAll(/\$(?:queryRawUnsafe|executeRawUnsafe)\b/g)) findings["RAW-UNSAFE"].push(`${where}:${lineOf(src, m.index)}`);
}

const titles = {
  UNBOUNDED: "findMany sans take (lecture non bornée)",
  "UNBOUNDED-IN": "findMany sans take, borné par une liste `in:` (vérifier la taille de la liste)",
  LOOP: "appels Prisma attendus dans une boucle (candidats N+1)",
  OFFSET: "pagination par décalage (skip)",
  "NEW-CLIENT": "PrismaClient instancié hors du singleton",
  "RAW-UNSAFE": "SQL brut non paramétré",
};
console.log(`query-audit — ${ROOT}`);
console.log(`${totalFindMany} findMany analysés\n`);
for (const [id, list] of Object.entries(findings)) {
  console.log(`[${id}] ${titles[id]} : ${list.length}`);
  if (!quiet) for (const item of list) console.log(`  - ${item}`);
  if (!quiet) console.log("");
}
if (maxUnbounded !== null && findings.UNBOUNDED.length > maxUnbounded) {
  console.error(`\n--max-unbounded=${maxUnbounded} dépassé : ${findings.UNBOUNDED.length} findMany sans take ni liste. Ajouter take, ou paginer par curseur.`);
  process.exit(1);
}
