// scripts/images/census.ts — Recensement des URL d'image de la base (lecture seule).
//
//   npx tsx scripts/images/census.ts [--probe] [--check-blob] [--check-local] [--out fichier.json]
//
// Depuis la racine du dépôt, DATABASE_URL exportée dans le terminal. N'écrit jamais en base.
// --probe       GET de chaque source https non durable (Unsplash, Pexels, autre stockage, autre hôte) :
//               statut, type, octets magiques ; 10 s et 12 Mo au plus par source.
// --check-blob  GET d'un octet (Range) sur chaque URL de notre stockage Blob : trouve les fichiers effacés.
// --check-local Vérifie que chaque photo du site (/img/...) existe dans public/.
// --out         Écrit le rapport complet (comptes, lignes, sondes) dans un nouveau fichier JSON.
// Procédure complète : docs/photos.md.
import type { ParseArgsConfig } from "node:util";
import prisma from "@/lib/prisma";
import { IMAGE_COLUMNS } from "@/lib/images/columns";
import { CENSUS_KIND_ORDER, runImageCensus, type CensusRow } from "./lib/census";
import { needsSourceProbe, type ProbeResult } from "./lib/repair-plan";
import {
  checkBlob,
  describeDatabase,
  localPublicFileExists,
  mapLimit,
  out,
  parseCommandLine,
  probeSource,
  requireDatabaseUrl,
  runScript,
  shorten,
  writeNewFile,
} from "./shared";

const OPTIONS = {
  probe: { type: "boolean", default: false },
  "check-blob": { type: "boolean", default: false },
  "check-local": { type: "boolean", default: false },
  out: { type: "string" },
} satisfies ParseArgsConfig["options"];

const UNSPLASH_HOST = "images.unsplash.com";

function distinct(rows: readonly CensusRow[], keep: (row: CensusRow) => boolean): string[] {
  return [...new Set(rows.filter(keep).map((row) => row.value))].sort();
}

function printCounts(counts: Awaited<ReturnType<typeof runImageCensus>>["counts"]): void {
  out("Valeurs par table, colonne et catégorie :");
  for (const entry of IMAGE_COLUMNS) {
    const ofColumn = counts
      .filter((count) => count.table === entry.table && count.column === entry.column)
      .sort((a, b) => CENSUS_KIND_ORDER.indexOf(a.kind) - CENSUS_KIND_ORDER.indexOf(b.kind));
    const detail =
      ofColumn.length === 0 ? "table vide" : ofColumn.map((c) => `${c.kind} ${c.count}`).join(", ");
    out(`  ${`${entry.table}.${entry.column}`.padEnd(36)} ${detail}`);
  }
}

function printUnsplashRows(rows: readonly CensusRow[]): void {
  const unsplash = rows
    .filter(
      (row) =>
        (row.table === "products" || row.table === "product_images") &&
        row.kind === "LEGACY_DISPLAY"
    )
    .filter((row) => new URL(row.value).hostname === UNSPLASH_HOST)
    .sort(
      (a, b) =>
        (a.shopSlug ?? "").localeCompare(b.shopSlug ?? "") ||
        (a.label ?? "").localeCompare(b.label ?? "") ||
        a.id.localeCompare(b.id)
    );
  out();
  out(
    `Produits avec une photo Unsplash : ${unsplash.length} ligne(s) (boutique | table | id | produit | URL)`
  );
  for (const row of unsplash) {
    out(`  ${row.shopSlug ?? "-"} | ${row.table} | ${row.id} | ${row.label ?? "-"} | ${row.value}`);
  }
}

function printFailures(title: string, results: readonly ProbeResult[]): void {
  const failed = results.filter((result) => !result.alive);
  out();
  out(`${title} : ${results.length} vérifiée(s), ${failed.length} en échec`);
  for (const result of failed) {
    out(
      `  ${result.status ?? "-"} ${result.error ?? ""} ${shorten(result.url)}`.replace(/\s+/g, " ")
    );
  }
}

async function main(): Promise<void> {
  const { values: args } = parseCommandLine({ args: process.argv.slice(2), options: OPTIONS });
  const databaseUrl = requireDatabaseUrl();
  out(`Base : ${describeDatabase(databaseUrl)} (lecture seule)`);

  const report = await runImageCensus(prisma);
  printCounts(report.counts);
  printUnsplashRows(report.rows);

  const probes = args.probe
    ? await mapLimit(distinct(report.rows, needsSourceProbe), probeSource)
    : [];
  if (args.probe) printFailures("Sources non durables sondées", probes);

  const blobChecks = args["check-blob"]
    ? await mapLimit(
        distinct(report.rows, (row) => row.kind === "BLOB"),
        checkBlob
      )
    : [];
  if (args["check-blob"]) printFailures("Fichiers de notre stockage Blob", blobChecks);

  const missingLocal = args["check-local"]
    ? distinct(report.rows, (row) => row.kind === "LOCAL_STATIC").filter(
        (value) => !localPublicFileExists(value)
      )
    : [];
  if (args["check-local"]) {
    out();
    out(`Photos du site absentes de public/ : ${missingLocal.length}`);
    for (const value of missingLocal) out(`  ${value}`);
  }

  const file = args.out;
  if (file !== undefined) {
    const at = new Date().toISOString();
    const content = {
      at,
      database: describeDatabase(databaseUrl),
      ...report,
      probes,
      blobChecks,
      missingLocal,
    };
    writeNewFile(file, `${JSON.stringify(content, null, 1)}\n`);
    out();
    out(`Rapport écrit dans ${file}`);
  }
  out();
  out("Recensement terminé : rien n'a été modifié dans la base.");
}

runScript(main);
