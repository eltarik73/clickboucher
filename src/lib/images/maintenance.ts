// src/lib/images/maintenance.ts — Les deux opérations d'écriture du propriétaire sur les images,
// appelées par scripts/images/repair.ts et purge.ts (jamais par une route).
//
// applyRepairs exécute un plan de planRepairs :
// - COPY : la source est téléchargée (fetchSource, injecté), enregistrée par persistImage (modèle
//   REPAIR, dossier « repair »), puis chaque ligne est remplacée par compare-and-swap
//   (UPDATE … WHERE id = $id AND colonne = ancienne valeur), toutes dans une transaction. Une ligne
//   modifiée depuis le recensement n'est pas touchée (« skipped-changed ») ; si aucune ne l'est, la
//   copie est retirée (ligne du registre et fichiers).
// - NULL : le même compare-and-swap vers NULL, seulement sur une colonne qui l'admet.
// - SKIP et DECIDE : rien.
// Chaque ligne traitée donne une entrée de journal (journal, injecté) écrite après la validation.
//
// purgeImage efface une image de notre stockage (retrait sur demande) : refusée tant qu'une colonne
// d'image l'utilise ; sinon les deux fichiers, puis les lignes du registre qui la portent.
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { sqlIdentifier, type CensusRow } from "./census";
import { classifyImageUrl } from "./durable-url";
import { ImageRejectedError } from "./errors";
import {
  FETCHED_SOURCE_MAX_BYTES,
  persistImage,
  prismaImageRegistry,
  type PersistedImage,
} from "./ingest";
import { findImageReferences, imageInUse, type ImageReferences } from "./references";
import { imageColumnOf, registryUsageFor, type RepairAction } from "./repair-plan";
import type { ImageStore } from "./store";
import { thumbnailOf } from "./thumbnail";

/** Valeur de generated_images.model et created_by d'une image copiée par la réparation. */
export const REPAIR_REGISTRY_MODEL = "REPAIR";
export const REPAIR_CREATED_BY = "repair";
const REPAIR_FOLDER = "repair";

export type RepairJournalAction = "copied" | "nulled" | "skipped-changed";

export interface RepairJournalEntry {
  at: string;
  table: string;
  column: string;
  id: string;
  old: string;
  /** Valeur écrite (ou qui l'aurait été pour « skipped-changed »). */
  new: string | null;
  action: RepairJournalAction;
}

export interface RepairDeps {
  store: ImageStore;
  fetchSource(url: string): Promise<Uint8Array>;
  journal(entry: RepairJournalEntry): void;
  now?: () => Date;
}

export interface RepairFailure {
  source: string;
  rows: number;
  messageFr: string;
}

export interface RepairSummary {
  copied: number;
  nulled: number;
  skippedChanged: number;
  /** Actions SKIP et DECIDE, laissées telles quelles. */
  untouched: number;
  failures: RepairFailure[];
}

function compareAndSwap(row: CensusRow, next: string | null): Prisma.PrismaPromise<number> {
  const entry = imageColumnOf(row.table, row.column);
  if (next === null && !entry.nullable) {
    throw new Error(`${row.table}.${row.column} n'admet pas NULL`);
  }
  const table = Prisma.raw(sqlIdentifier(entry.table));
  const column = Prisma.raw(sqlIdentifier(entry.column));
  return prisma.$executeRaw(
    Prisma.sql`UPDATE ${table} SET ${column} = ${next} WHERE id = ${row.id} AND ${column} = ${row.value}`
  );
}

function journalRows(
  deps: RepairDeps,
  summary: RepairSummary,
  rows: readonly CensusRow[],
  counts: readonly number[],
  next: string | null
): void {
  const at = (deps.now ?? (() => new Date()))().toISOString();
  rows.forEach((row, index) => {
    const done = counts[index] === 1;
    const action: RepairJournalAction = done
      ? next === null
        ? "nulled"
        : "copied"
      : "skipped-changed";
    if (!done) summary.skippedChanged += 1;
    else if (next === null) summary.nulled += 1;
    else summary.copied += 1;
    deps.journal({
      at,
      table: row.table,
      column: row.column,
      id: row.id,
      old: row.value,
      new: next,
      action,
    });
  });
}

/** Copie devenue inutile (toutes ses lignes ont changé) : ligne du registre puis fichiers. */
async function discardCopy(image: PersistedImage, store: ImageStore): Promise<void> {
  await prisma.generatedImage.deleteMany({ where: { id: image.id } });
  for (const url of [image.url, image.thumbUrl]) {
    try {
      await store.del(url);
    } catch (error) {
      logger.warn("[images] copie de réparation inutilisée restée dans le stockage", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function applyCopy(
  action: Extract<RepairAction, { action: "COPY" }>,
  deps: RepairDeps,
  summary: RepairSummary
): Promise<void> {
  const fail = (messageFr: string) =>
    summary.failures.push({ source: action.source, rows: action.rows.length, messageFr });
  let bytes: Uint8Array;
  try {
    bytes = await deps.fetchSource(action.source);
  } catch (error) {
    fail(`téléchargement impossible : ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const first = action.rows[0];
  let image: PersistedImage;
  try {
    image = await persistImage(
      {
        bytes,
        owner: { shopId: first.shopId, createdBy: REPAIR_CREATED_BY },
        registry: {
          model: REPAIR_REGISTRY_MODEL,
          prompt: "",
          usage: registryUsageFor(first.table),
        },
        maxBytes: FETCHED_SOURCE_MAX_BYTES,
        folder: REPAIR_FOLDER,
      },
      { store: deps.store, registry: prismaImageRegistry }
    );
  } catch (error) {
    // Un fichier refusé n'arrête que cette copie ; une panne du stockage ou de la base arrête tout.
    if (!(error instanceof ImageRejectedError)) throw error;
    fail(error.messageFr);
    return;
  }

  const counts = await prisma.$transaction(
    action.rows.map((row) => compareAndSwap(row, image.url))
  );
  journalRows(deps, summary, action.rows, counts, image.url);
  if (counts.every((count) => count === 0)) await discardCopy(image, deps.store);
}

export async function applyRepairs(
  actions: readonly RepairAction[],
  deps: RepairDeps
): Promise<RepairSummary> {
  const summary: RepairSummary = {
    copied: 0,
    nulled: 0,
    skippedChanged: 0,
    untouched: 0,
    failures: [],
  };
  for (const action of actions) {
    if (action.action === "COPY") {
      await applyCopy(action, deps, summary);
    } else if (action.action === "NULL") {
      const counts = await prisma.$transaction([compareAndSwap(action.row, null)]);
      journalRows(deps, summary, [action.row], counts, null);
    } else {
      summary.untouched += 1;
    }
  }
  return summary;
}

export interface PurgePlan {
  url: string;
  /** La photo et sa vignette quand elle en a une. */
  files: string[];
  references: ImageReferences;
  registryRows: number;
  /** Pourquoi l'effacement est refusé, ou null. */
  refusal: string | null;
}

export class PurgeRefusedError extends Error {
  constructor(readonly messageFr: string) {
    super(messageFr);
    this.name = "PurgeRefusedError";
  }
}

export async function planPurge(url: string): Promise<PurgePlan> {
  const thumb = thumbnailOf(url);
  const [references, registryRows] = await Promise.all([
    findImageReferences(url, null),
    prisma.generatedImage.count({ where: { imageUrl: url } }),
  ]);
  const kind = classifyImageUrl(url);
  let refusal: string | null = null;
  if (kind !== "BLOB" && kind !== "LOCAL_STORE") {
    refusal =
      "Cette adresse n'est pas un fichier de notre stockage : il n'y a rien à effacer chez nous.";
  } else if (imageInUse(references)) {
    refusal =
      `Image encore utilisée par ${references.otherUses} ligne(s) de la base : ` +
      "remplacez-la partout (le recensement les liste) avant de l'effacer.";
  }
  return { url, files: thumb === null ? [url] : [url, thumb], references, registryRows, refusal };
}

export async function purgeImage(
  url: string,
  store: ImageStore
): Promise<{ files: string[]; deletedRows: number }> {
  const plan = await planPurge(url);
  if (plan.refusal !== null) throw new PurgeRefusedError(plan.refusal);
  if ((classifyImageUrl(url) === "BLOB") !== (store.kind === "blob")) {
    throw new PurgeRefusedError(
      store.kind === "blob"
        ? "Cette image est dans le stockage local de développement, pas dans Vercel Blob."
        : "Cette image est dans Vercel Blob : exportez BLOB_READ_WRITE_TOKEN dans votre terminal."
    );
  }
  for (const file of plan.files) await store.del(file);
  const { count } = await prisma.generatedImage.deleteMany({ where: { imageUrl: url } });
  return { files: plan.files, deletedRows: count };
}
