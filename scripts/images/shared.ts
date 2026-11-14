// scripts/images/shared.ts — Outils communs des scripts du propriétaire (census, repair, purge) :
// arguments, sorties, sondes réseau, téléchargement d'une source, journal.
//
// Les règles (quoi sonder, quoi copier, quand écrire) sont dans src/lib/images/repair-plan.ts ;
// ce fichier ne fait que les entrées-sorties. Aucune requête vers klikandgo.app n'est faite : seules
// les adresses d'image enregistrées en base sont demandées, en GET.
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import prisma from "@/lib/prisma";
import { FETCHED_SOURCE_MAX_BYTES } from "@/lib/images/ingest";
import { sniffImageFormat } from "@/lib/images/process";
import { isAllowedCopySource, isProbeableUrl, type ProbeResult } from "@/lib/images/repair-plan";

const USER_AGENT = "klikgo-image-maintenance/1.0";
const PROBE_TIMEOUT_MS = 10_000;
const COPY_TIMEOUT_MS = 15_000;
const PROBE_CONCURRENCY = 4;

export function out(line = ""): void {
  process.stdout.write(`${line}\n`);
}

export function err(line: string): void {
  process.stderr.write(`${line}\n`);
}

export class UsageError extends Error {}

export interface ParsedArgs {
  flags: Set<string>;
  options: Map<string, string[]>;
  positionals: string[];
}

/** Arguments connus seulement : un argument inconnu est refusé (une faute de frappe ne passe pas en silence). */
export function parseArgs(
  argv: readonly string[],
  spec: { flags: string[]; options: string[] }
): ParsedArgs {
  const parsed: ParsedArgs = { flags: new Set(), options: new Map(), positionals: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (spec.flags.includes(arg)) {
      parsed.flags.add(arg);
    } else if (spec.options.includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--"))
        throw new UsageError(`${arg} attend une valeur.`);
      parsed.options.set(arg, [...(parsed.options.get(arg) ?? []), value]);
      i += 1;
    } else if (arg.startsWith("--")) {
      throw new UsageError(`Option inconnue : ${arg}`);
    } else {
      parsed.positionals.push(arg);
    }
  }
  return parsed;
}

/** Hôte et base visés, sans identifiants : seule forme de DATABASE_URL jamais affichée. */
export function describeDatabase(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
}

export function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (value === undefined || value.trim() === "" || !URL.canParse(value)) {
    throw new UsageError(
      "DATABASE_URL n'est pas définie. Exportez-la dans votre terminal (jamais dans un fichier suivi par git), " +
        "puis relancez la commande depuis la racine du dépôt."
    );
  }
  return value;
}

/** Lance le script : message français et code 1 en cas d'échec, connexion à la base toujours fermée. */
export function runScript(main: () => Promise<void>): void {
  main()
    .catch((error: unknown) => {
      process.exitCode = 1;
      if (error instanceof UsageError) err(error.message);
      else if (error instanceof Error && "messageFr" in error) err(String(error.messageFr));
      else
        err(`Échec : ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    })
    .finally(() => prisma.$disconnect());
}

/** Le chemin /img/... existe-t-il dans public/ ? */
export function localPublicFileExists(urlPath: string): boolean {
  const publicDir = path.join(process.cwd(), "public");
  const file = path.resolve(publicDir, `.${urlPath}`);
  return (
    file.startsWith(publicDir + path.sep) &&
    statSync(file, { throwIfNoEntry: false })?.isFile() === true
  );
}

export async function mapLimit<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, items.length) }, worker));
  return results;
}

function networkError(error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    return "délai dépassé";
  return `réseau : ${error instanceof Error ? error.message : String(error)}`;
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function get(
  url: string,
  timeoutMs: number,
  headers: Record<string, string> = {}
): Promise<Response> {
  return fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": USER_AGENT, ...headers },
  });
}

/** GET d'une source non durable : vivante si elle répond 2xx avec une image JPEG, PNG, WebP, GIF ou AVIF. */
export async function probeSource(url: string): Promise<ProbeResult> {
  const result: ProbeResult = { url, alive: false, status: null, contentType: null };
  if (!isProbeableUrl(url))
    return { ...result, error: "adresse refusée (https vers un hôte public seulement)" };
  try {
    const response = await get(url, PROBE_TIMEOUT_MS, { accept: "image/*" });
    result.status = response.status;
    result.contentType = response.headers.get("content-type");
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return { ...result, error: `redirection non suivie (${response.status})` };
    }
    if (!response.ok) {
      await response.body?.cancel();
      return result;
    }
    const bytes = await readCapped(response, FETCHED_SOURCE_MAX_BYTES);
    if (bytes === null) return { ...result, error: "plus de 12 Mo" };
    const format = sniffImageFormat(bytes);
    if (format === null) return { ...result, error: "pas une image" };
    if (format === "heic") return { ...result, error: "HEIC, non pris en charge" };
    return { ...result, alive: true };
  } catch (error) {
    return { ...result, error: networkError(error) };
  }
}

/** Notre fichier Blob existe-t-il ? GET d'un seul octet sur l'URL publique : ni SDK, ni /_next/image. */
export async function checkBlob(url: string): Promise<ProbeResult> {
  const result: ProbeResult = { url, alive: false, status: null, contentType: null };
  if (!isProbeableUrl(url)) return { ...result, error: "adresse refusée" };
  try {
    const response = await get(url, PROBE_TIMEOUT_MS, { range: "bytes=0-0" });
    await response.body?.cancel();
    return {
      ...result,
      status: response.status,
      contentType: response.headers.get("content-type"),
      alive: response.status === 200 || response.status === 206,
    };
  } catch (error) {
    return { ...result, error: networkError(error) };
  }
}

/** Téléchargement d'une source à copier : hôtes autorisés seulement, sans redirection, 15 s, 12 Mo. */
export async function fetchCopySource(
  url: string,
  extraHosts: readonly string[]
): Promise<Uint8Array> {
  if (!isAllowedCopySource(url, extraHosts)) {
    throw new Error(
      `hôte non autorisé (${new URL(url).hostname}) : ajoutez --allow-host si la source est sûre`
    );
  }
  let response: Response;
  try {
    response = await get(url, COPY_TIMEOUT_MS, { accept: "image/*" });
  } catch (error) {
    throw new Error(networkError(error));
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`statut ${response.status}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    await response.body?.cancel();
    throw new Error(`type « ${type || "absent"} » au lieu d'une image`);
  }
  const bytes = await readCapped(response, FETCHED_SOURCE_MAX_BYTES);
  if (bytes === null) throw new Error("plus de 12 Mo");
  return bytes;
}

/** Fichier JSON de sortie ; un fichier existant n'est jamais écrasé. */
export function writeNewFile(file: string, content: string): void {
  if (existsSync(file))
    throw new UsageError(`${file} existe déjà : choisissez un autre nom de fichier.`);
  writeFileSync(file, content, { flag: "wx" });
}

export function shorten(value: string, max = 120): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
