#!/usr/bin/env node
// Vérifie les frontières de dépendances (lecture seule). À lancer depuis la racine du dépôt.
// Sortie : une ligne par import interdit, puis le total.
// Codes de sortie : 0 = aucun écart ; 1 = au moins un écart ; 2 = ESLint n'a pas pu tourner
// (mauvais dossier, dépendances absentes, erreur de configuration) — jamais un faux « 0 écart ».
// Les erreurs « Definition for rule … was not found » (commentaires eslint-disable de règles
// non chargées ici) sont filtrées : seules les règles de frontière comptent.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = path.join(here, "boundaries.eslintrc.cjs");
const eslintBin = path.join(process.cwd(), "node_modules", "eslint", "bin", "eslint.js");

if (!existsSync(eslintBin) || !existsSync(path.join(process.cwd(), "src"))) {
  console.error("check-boundaries : à lancer depuis la racine du dépôt (node_modules/eslint et src/ attendus).");
  process.exit(2);
}

const run = spawnSync(
  process.execPath,
  [eslintBin, "--no-eslintrc", "-c", config, "--resolve-plugins-relative-to", ".", "--no-cache",
   "--format", "unix", "--ext", ".ts,.tsx", "src"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);

// ESLint : 0 = rien, 1 = erreurs de lint, 2 = plantage ou configuration invalide.
if (run.error || run.status === null || run.status >= 2) {
  console.error("check-boundaries : ESLint n'a pas pu analyser le code.");
  console.error(run.error ? String(run.error) : `${run.stdout}${run.stderr}`.trim().split("\n").slice(0, 15).join("\n"));
  process.exit(2);
}

const lines = `${run.stdout}${run.stderr}`
  .split("\n")
  .filter((l) => /\[Error\/(import\/no-restricted-paths|import\/no-cycle|no-restricted-imports)\]/.test(l))
  .map((l) => l.replace(`${process.cwd()}/`, ""));
for (const l of lines) console.log(l);
console.log(`\n${lines.length} import(s) hors frontière`);
process.exit(lines.length > 0 ? 1 : 0);
