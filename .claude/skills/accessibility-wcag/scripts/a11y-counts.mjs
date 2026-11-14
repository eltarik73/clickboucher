#!/usr/bin/env node
// Recompte les chiffres clés de references/audit-code-2026-11.md sur l'arbre de travail courant.
// Lecture seule, sans dépendance. Usage (depuis la racine du dépôt) :
//   node .claude/skills/accessibility-wcag/scripts/a11y-counts.mjs [dossier=src] [--list]
// --list ajoute les fichiers à superposition maison et les <main> imbriqués. Les comptages sont des recherches de texte dans les fichiers .tsx : ce sont des indicateurs de
// tendance, pas une preuve de conformité.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const root = args.find((arg) => !arg.startsWith("--")) ?? "src";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

let files;
try {
  files = walk(root).map((path) => ({ path, text: readFileSync(path, "utf8") }));
} catch {
  console.error(`Dossier introuvable : ${root}. Lancer depuis la racine du dépôt.`);
  process.exit(2);
}

const occurrences = (re) => files.reduce((n, f) => n + (f.text.match(re)?.length ?? 0), 0);
const filesWith = (re) => files.filter((f) => re.test(f.text));

const RADIX = /@radix-ui\/react-dialog|components\/ui\/(dialog|sheet|ConfirmDialog)"/;
const PRIMITIVES = /components\/ui\/(dialog|sheet|ConfirmDialog)\.tsx$/;
const overlays = filesWith(/fixed inset-0/);
const handWritten = overlays.filter((f) => !RADIX.test(f.text) && !PRIMITIVES.test(f.path));
const radixConsumers = filesWith(RADIX).filter((f) => !PRIMITIVES.test(f.path));
const mains = filesWith(/<main\b/).filter((f) => !/src\/app\/layout\.tsx$/.test(f.path));

const rows = [
  ["Fichiers avec une superposition écrite à la main (fixed inset-0, sans Radix)", handWritten.length],
  ["Fichiers qui consomment ui/dialog, ui/sheet ou ConfirmDialog", radixConsumers.length],
  ['Fichiers avec role="dialog" écrit à la main', filesWith(/role="dialog"/).length],
  ["DialogTrigger / SheetTrigger hors ui/", filesWith(/<(Dialog|Sheet)Trigger\b/).length],
  ['aria-live, role="status", role="alert" (occurrences)', occurrences(/aria-live|role="status"|role="alert"/g)],
  ['role="tab", role="tablist", aria-selected (occurrences)', occurrences(/role="tab"|role="tablist"|aria-selected/g)],
  ["htmlFor (occurrences)", occurrences(/htmlFor/g)],
  ["<label (occurrences)", occurrences(/<label\b/g)],
  ["Champs <input|textarea|select|Input (occurrences)", occurrences(/<(input|textarea|select|Input)\b/g)],
  ["aria-invalid, aria-describedby, aria-errormessage (occurrences)", occurrences(/aria-invalid|aria-describedby|aria-errormessage/g)],
  ["focus:outline-none (occurrences)", occurrences(/focus:outline-none/g)],
  ["Fichiers avec prefers-reduced-motion, motion-reduce: ou motion-safe:", filesWith(/prefers-reduced-motion|motion-reduce:|motion-safe:/).length],
  ["animate-pulse|ping|bounce|spin (occurrences)", occurrences(/animate-(pulse|ping|bounce|spin)/g)],
  ["title= (occurrences, props de composants comprises)", occurrences(/\btitle=/g)],
  ["aria-hidden (occurrences)", occurrences(/aria-hidden/g)],
  ["text-[10px] / text-[11px] / text-[9px] ou [8px]", `${occurrences(/text-\[10px\]/g)} / ${occurrences(/text-\[11px\]/g)} / ${occurrences(/text-\[(9|8)px\]/g)}`],
  ["Fichiers avec <main> (hors src/app/layout.tsx)", mains.length],
  ['Fichiers qui importent "sonner"', filesWith(/from "sonner"/).length],
];

const width = Math.max(...rows.map(([label]) => label.length));
console.log(`Comptages accessibilité — ${files.length} fichiers .tsx sous ${root}/\n`);
for (const [label, value] of rows) console.log(`${label.padEnd(width)}  ${value}`);

if (args.includes("--list")) {
  console.log("\nSuperpositions écrites à la main :");
  for (const f of handWritten) console.log(`  ${relative(".", f.path)}`);
  console.log("\n<main> imbriqués :");
  for (const f of mains) console.log(`  ${relative(".", f.path)}`);
}
