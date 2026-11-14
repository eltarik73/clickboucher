#!/usr/bin/env node
// Rapport de taille des sources (lecture seule). À lancer depuis la racine du dépôt :
//   node .claude/skills/architecture-conventions/scripts/size-report.mjs [seuil=300] [top=25]
// Compte les lignes des .ts/.tsx de src/ hors tests (même résultat que `wc -l`), liste les plus
// gros fichiers et le nombre de fichiers au-delà du seuil de CLAUDE.md (300 lignes) et de 500.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const threshold = Number(process.argv[2] ?? 300);
const top = Number(process.argv[3] ?? 25);

if (!existsSync("src")) {
  console.error("size-report : à lancer depuis la racine du dépôt (src/ attendu).");
  process.exit(2);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Nombre de lignes au sens de `wc -l` (une dernière ligne sans saut de ligne compte aussi). */
function countLines(text) {
  if (text.length === 0) return 0;
  const newlines = text.split("\n").length - 1;
  return text.endsWith("\n") ? newlines : newlines + 1;
}

const rows = walk("src")
  .map((file) => ({ file, lines: countLines(readFileSync(file, "utf8")) }))
  .sort((a, b) => b.lines - a.lines);

for (const { file, lines } of rows.slice(0, top)) console.log(`${String(lines).padStart(5)}  ${file}`);
console.log(
  `\n${rows.length} fichiers ; > ${threshold} lignes : ${rows.filter((r) => r.lines > threshold).length} ; ` +
    `> 500 lignes : ${rows.filter((r) => r.lines > 500).length}`
);
