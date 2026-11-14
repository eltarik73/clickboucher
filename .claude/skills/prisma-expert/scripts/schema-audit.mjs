#!/usr/bin/env node
/**
 * schema-audit.mjs — audit statique (lecture seule) de prisma/schema.prisma.
 *
 * Usage (depuis la racine du dépôt) :
 *   node .claude/skills/prisma-expert/scripts/schema-audit.mjs [chemin/schema.prisma] [--strict]
 *
 * Ne se connecte à aucune base, ne modifie rien. Signale :
 *   FK-INDEX   clé étrangère sans index dont elle est la première colonne
 *              (PostgreSQL n'indexe pas la colonne référençante : chaque DELETE du parent
 *              parcourt la table fille ; mesuré ici, voir references/index-et-requetes.md)
 *   DUP-INDEX  index doublon d'une contrainte unique, ou préfixe strict d'un autre index
 *   FLOAT      champ Float dont le nom évoque un montant ou un taux
 *   SOFT-REF   champ String terminé par « Id » qui n'appartient à aucune relation
 *              (aucune intégrité référentielle : à justifier ou à transformer en relation)
 *   ON-DELETE  relation sans onDelete explicite (défaut Prisma : Restrict si obligatoire,
 *              SetNull si optionnelle)
 *
 * Code de sortie : 0 par défaut. Avec --strict : 1 s'il existe au moins un FK-INDEX ou DUP-INDEX.
 * Ce sont des heuristiques sur le texte du schéma : relire chaque ligne avant d'agir.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const file = resolve(args.find((a) => !a.startsWith("--")) ?? "prisma/schema.prisma");
if (!existsSync(file)) {
  console.error(`schema introuvable : ${file}\nLancer depuis la racine du dépôt ou passer le chemin en argument.`);
  process.exit(2);
}
const src = readFileSync(file, "utf8");

const stripComment = (line) => line.replace(/\/\/.*$/, "").trim();
const firstCols = (list) =>
  list
    .split(",")
    .map((c) => c.trim().replace(/\(.*$/, ""))
    .filter(Boolean);

const models = [...src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(([, name, body]) => {
  const lines = body.split("\n").map(stripComment).filter(Boolean);
  const indexes = []; // { kind: "index" | "unique" | "id", cols: string[], raw: string }
  const relations = []; // { field: string, hasOnDelete: boolean }
  const fields = []; // { name, type, attrs }
  for (const line of lines) {
    let m;
    if ((m = line.match(/^@@(index|unique|id)\(\[([^\]]+)\]/))) {
      indexes.push({ kind: m[1], cols: firstCols(m[2]), raw: line });
      continue;
    }
    if (line.startsWith("@@")) continue;
    if ((m = line.match(/^(\w+)\s+([\w.]+(?:\[\])?\??)\s*(.*)$/))) {
      const [, fname, ftype, attrs] = m;
      fields.push({ name: fname, type: ftype, attrs });
      if (/@(unique|id)\b/.test(attrs)) indexes.push({ kind: /@id\b/.test(attrs) ? "id" : "unique", cols: [fname], raw: line });
      const rel = attrs.match(/@relation\((?:"[^"]*",\s*)?fields:\s*\[([^\]]+)\]([^)]*)\)/);
      if (rel) relations.push({ field: rel[1].split(",")[0].trim(), hasOnDelete: /onDelete\s*:/.test(rel[2]) });
    }
  }
  return { name, indexes, relations, fields };
});

const findings = { "FK-INDEX": [], "DUP-INDEX": [], FLOAT: [], "SOFT-REF": [], "ON-DELETE": [] };

for (const model of models) {
  const leading = new Set(model.indexes.map((i) => i.cols[0]));
  for (const rel of model.relations) {
    if (!leading.has(rel.field)) findings["FK-INDEX"].push(`${model.name}.${rel.field}  →  ajouter @@index([${rel.field}])`);
    if (!rel.hasOnDelete) findings["ON-DELETE"].push(`${model.name}.${rel.field}`);
  }

  const plain = model.indexes.filter((i) => i.kind === "index");
  for (const idx of plain) {
    const key = idx.cols.join(",");
    const dupOfUnique = model.indexes.find((o) => o !== idx && o.kind !== "index" && o.cols.join(",") === key);
    if (dupOfUnique) {
      findings["DUP-INDEX"].push(`${model.name}  ${idx.raw}  double la contrainte ${dupOfUnique.kind} sur [${key}]`);
      continue;
    }
    const coveredBy = model.indexes.find(
      (o) => o !== idx && o.cols.length > idx.cols.length && idx.cols.every((c, n) => o.cols[n] === c)
    );
    if (coveredBy) {
      findings["DUP-INDEX"].push(`${model.name}  ${idx.raw}  est un préfixe de [${coveredBy.cols.join(", ")}]`);
      continue;
    }
    const twin = plain.find((o) => o !== idx && o.cols.join(",") === key);
    if (twin && plain.indexOf(twin) < plain.indexOf(idx)) {
      findings["DUP-INDEX"].push(`${model.name}  ${idx.raw}  déclaré deux fois`);
      continue;
    }
    const sorted = [...idx.cols].sort().join(",");
    const permuted = plain.find((o) => o !== idx && o.cols.length === idx.cols.length && [...o.cols].sort().join(",") === sorted);
    if (permuted && plain.indexOf(permuted) < plain.indexOf(idx)) {
      findings["DUP-INDEX"].push(`${model.name}  ${idx.raw}  mêmes colonnes que [${permuted.cols.join(", ")}] dans un autre ordre : garder celui que la requête utilise (EXPLAIN)`);
    }
  }

  const relationScalars = new Set(model.relations.map((r) => r.field));
  // Identifiants de systèmes externes : pas de table locale à référencer.
  const externalId = /^(clerk|stripe|google|external|session)/i;
  for (const f of model.fields) {
    if (/^Float\??$/.test(f.type) && !/^cached/i.test(f.name) && /(cents|amount|price|pct|percent|rate|discount|minOrder|value|commission)/i.test(f.name)) {
      findings.FLOAT.push(`${model.name}.${f.name}  (${f.type})`);
    }
    if (/^String\??$/.test(f.type) && /[a-z]Id$/.test(f.name) && !relationScalars.has(f.name) && !/@id\b/.test(f.attrs) && !externalId.test(f.name)) {
      findings["SOFT-REF"].push(`${model.name}.${f.name}`);
    }
  }
}

const titles = {
  "FK-INDEX": "Clés étrangères sans index",
  "DUP-INDEX": "Index redondants (coût d'écriture sans gain de lecture)",
  FLOAT: "Float sur un montant ou un taux (règle : Int en centimes, points de base ou Decimal)",
  "SOFT-REF": "Références sans contrainte (String …Id hors relation)",
  "ON-DELETE": "Relations sans onDelete explicite",
};
console.log(`schema-audit — ${file}`);
console.log(`${models.length} modèles, ${models.reduce((n, m) => n + m.relations.length, 0)} clés étrangères, ${models.reduce((n, m) => n + m.indexes.filter((i) => i.kind === "index").length, 0)} @@index\n`);
for (const [id, list] of Object.entries(findings)) {
  console.log(`[${id}] ${titles[id]} : ${list.length}`);
  for (const item of list) console.log(`  - ${item}`);
  console.log("");
}
const blocking = findings["FK-INDEX"].length + findings["DUP-INDEX"].length;
if (strict && blocking > 0) {
  console.error(`--strict : ${blocking} constat(s) FK-INDEX ou DUP-INDEX.`);
  process.exit(1);
}
