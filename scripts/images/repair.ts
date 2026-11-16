// scripts/images/repair.ts — Réparer les URL d'image non durables. Essai à blanc par défaut.
//
//   npx tsx scripts/images/repair.ts [--check-blob] [--allow-host hôte]... [--out plan.json]
//   npx tsx scripts/images/repair.ts --apply --journal journal.jsonl [--check-blob] [--allow-host hôte]...
//
// Depuis la racine du dépôt, DATABASE_URL exportée dans le terminal. Le plan vient de planRepairs
// (scripts/images/lib/repair-plan.ts) : copie dans notre stockage des sources vivantes, NULL des sources
// mortes là où l'affichage a un repli, et la liste des lignes à décider, jamais touchées.
// --apply écrit seulement avec BLOB_READ_WRITE_TOKEN exporté (stockage Vercel Blob), ou sur une base
// locale (répétition avec le stockage sur disque). Chaque ligne modifiée est remplacée par
// compare-and-swap et notée dans le journal JSONL (ancienne et nouvelle valeur) : docs/photos.md
// donne la requête qui annule. Aucune table n'est créée.
import { appendFileSync, existsSync } from "node:fs";
import type { ParseArgsConfig } from "node:util";
import prisma from "@/lib/prisma";
import { getImageStore, type ImageStore } from "@/lib/images/store";
import { runImageCensus, type CensusRow } from "./lib/census";
import { applyRepairs } from "./lib/maintenance";
import {
  applyRefusal,
  isAllowedCopySource,
  needsSourceProbe,
  planRepairs,
  type ProbeResult,
  type RepairAction,
} from "./lib/repair-plan";
import {
  checkBlob,
  describeDatabase,
  fetchCopySource,
  localPublicFileExists,
  mapLimit,
  out,
  parseCommandLine,
  probeSource,
  requireDatabaseUrl,
  runScript,
  shorten,
  UsageError,
  writeNewFile,
} from "./shared";

const OPTIONS = {
  apply: { type: "boolean", default: false },
  "check-blob": { type: "boolean", default: false },
  journal: { type: "string" },
  "allow-host": { type: "string", multiple: true, default: [] },
  out: { type: "string" },
} satisfies ParseArgsConfig["options"];

const describeRow = (row: CensusRow) =>
  `${row.table}.${row.column} ${row.id} ${row.shopSlug ?? "-"} ${row.label ?? ""}`.trim();

function printPlan(actions: readonly RepairAction[], allowHosts: readonly string[]): void {
  const of = <K extends RepairAction["action"]>(kind: K) =>
    actions.filter(
      (action): action is Extract<RepairAction, { action: K }> => action.action === kind
    );
  const copies = of("COPY");
  out(
    `Plan : ${copies.length} copie(s) pour ${copies.reduce((n, copy) => n + copy.rows.length, 0)} ligne(s), ` +
      `${of("NULL").length} mise(s) à NULL, ${of("DECIDE").length} ligne(s) à décider, ${of("SKIP").length} gardée(s).`
  );
  if (copies.length > 0) out("\nCOPIE dans notre stockage (une par source et par boutique) :");
  for (const copy of copies) {
    const allowed = isAllowedCopySource(copy.source, allowHosts)
      ? ""
      : "  [hôte non autorisé : --allow-host]";
    out(`  ${shorten(copy.source)}${allowed}`);
    for (const row of copy.rows) out(`    → ${describeRow(row)}`);
  }
  for (const kind of ["NULL", "DECIDE"] as const) {
    const list = of(kind);
    if (list.length === 0) continue;
    out(
      kind === "NULL"
        ? "\nMISE À NULL (source morte, l'affichage a un repli) :"
        : "\nÀ DÉCIDER (jamais modifié par ce script) :"
    );
    for (const action of list)
      out(`  ${describeRow(action.row)} | ${action.reason} | ${shorten(action.row.value)}`);
  }
}

function prepareApply(journalFile: string | undefined, databaseUrl: string): ImageStore {
  if (journalFile === undefined) throw new UsageError("--apply exige --journal <fichier.jsonl>.");
  if (existsSync(journalFile)) {
    throw new UsageError(
      `${journalFile} existe déjà : chaque passage a son propre journal, choisissez un autre nom.`
    );
  }
  const store = getImageStore();
  const refusal = applyRefusal(store.kind, databaseUrl);
  if (refusal !== null) throw new UsageError(refusal);
  return store;
}

async function main(): Promise<void> {
  const { values: args } = parseCommandLine({ args: process.argv.slice(2), options: OPTIONS });
  const databaseUrl = requireDatabaseUrl();
  const { apply, "allow-host": allowHosts, journal: journalFile } = args;
  const store = apply ? prepareApply(journalFile, databaseUrl) : null;
  out(
    `Base : ${describeDatabase(databaseUrl)} — ${apply ? `ÉCRITURE (stockage ${store?.kind})` : "essai à blanc"}`
  );

  const { rows } = await runImageCensus(prisma);
  const sources = [...new Set(rows.filter(needsSourceProbe).map((row) => row.value))];
  const blobs = args["check-blob"]
    ? [...new Set(rows.filter((row) => row.kind === "BLOB").map((row) => row.value))]
    : [];
  out(
    `Sondes : ${sources.length} source(s) non durable(s), ${blobs.length} fichier(s) de notre stockage.`
  );
  const probes: ProbeResult[] = [
    ...(await mapLimit(sources, probeSource)),
    ...(await mapLimit(blobs, checkBlob)),
  ];

  const actions = planRepairs(rows, new Map(probes.map((probe) => [probe.url, probe])), {
    localFileExists: localPublicFileExists,
  });
  printPlan(actions, allowHosts);

  const planFile = args.out;
  if (planFile !== undefined)
    writeNewFile(planFile, `${JSON.stringify({ actions, probes }, null, 1)}\n`);

  if (store === null || journalFile === undefined) {
    out(
      "\nEssai à blanc : rien n'a été écrit. Pour appliquer : ajoutez --apply --journal <nouveau-fichier.jsonl>."
    );
    return;
  }

  const summary = await applyRepairs(actions, {
    store,
    fetchSource: (url) => fetchCopySource(url, allowHosts),
    journal: (entry) => appendFileSync(journalFile, `${JSON.stringify(entry)}\n`),
  });
  out(
    `\nAppliqué : ${summary.copied} ligne(s) copiée(s), ${summary.nulled} mise(s) à NULL, ` +
      `${summary.skippedChanged} ligne(s) laissée(s) car modifiée(s) depuis le recensement. Journal : ${journalFile}`
  );
  for (const failure of summary.failures) {
    out(`  ÉCHEC ${shorten(failure.source)} (${failure.rows} ligne(s)) : ${failure.messageFr}`);
  }
  if (summary.failures.length > 0) process.exitCode = 1;
}

runScript(main);
