// scripts/images/lib/repair-plan.ts — Que faire de chaque URL d'image recensée : la garder, la copier
// dans notre stockage, la vider, ou la soumettre au propriétaire. Plus les gardes des scripts.
//
// Module pur (ni disque, ni base, ni réseau) : scripts/images/repair.ts lui passe le recensement
// (census.ts), le résultat des sondes et un test d'existence des fichiers de public/. Seule autorité :
// - SKIP : URL durable vivante ou non vérifiée ; photo du site présente ; magasin local de développement.
// - COPY : source https vivante (Unsplash/Pexels, autre magasin Blob, autre hôte). Une copie par
//   (source, boutique) pour toutes les lignes qui la portent : un produit et ses photos reçoivent
//   la même nouvelle URL, le miroir Product.imageUrl reste cohérent.
// - Source morte (lien Replicate, ancien chemin /api/uploads, réponse 404 ou 410) : NULL si la
//   colonne a un repli à l'affichage (nullWhenDead), sinon DECIDE.
// - DECIDE, jamais touché par le script : data:/blob:, valeur inconnue, photo du site absente,
//   sonde en échec pour une autre raison (délai, 5xx, pas une image…) ou absente, et toute ligne
//   du registre generated_images (la copier créerait un second enregistrement de la même image).
import { isLocalPostgresUrl } from "@/lib/local-postgres-url";
import { IMAGE_COLUMNS, IMAGE_REGISTRY_TABLE, type ImageColumn } from "@/lib/images/columns";
import { BLOB_HOST_SUFFIX, LEGACY_DISPLAY_HOSTS } from "@/lib/images/durable-url";
import type { CensusRow } from "./census";

export interface ProbeResult {
  url: string;
  alive: boolean;
  status: number | null;
  contentType: string | null;
  /** Raison d'un échec, en français (délai dépassé, pas une image, adresse refusée…). */
  error?: string;
}

export type RepairAction =
  | { action: "SKIP"; row: CensusRow; reason: string }
  | { action: "COPY"; rows: CensusRow[]; source: string }
  | { action: "NULL"; row: CensusRow; reason: string }
  | { action: "DECIDE"; row: CensusRow; reason: string };

export interface PlanOptions {
  /** Le fichier /img/... existe-t-il dans public/ ? */
  localFileExists(path: string): boolean;
}

/** Statuts qui prouvent qu'une source a disparu ; tout autre échec reste une décision humaine. */
const GONE_STATUSES: ReadonlySet<number> = new Set([404, 410]);

/** Colonnes dont l'image est un visuel (bannière, boutique, offre) plutôt qu'une photo d'aliment. */
const VISUAL_TABLES: ReadonlySet<string> = new Set([
  "shops",
  "offers",
  "campaigns",
  "site_banners",
]);

export function imageColumnOf(table: string, column: string): ImageColumn {
  const entry = IMAGE_COLUMNS.find(
    (candidate) => candidate.table === table && candidate.column === column
  );
  if (entry === undefined) throw new Error(`Colonne d'image inconnue : ${table}.${column}`);
  return entry;
}

/** Usage du registre pour une copie : PRODUCT pour les photos d'aliments, BANNER pour les visuels. */
export function registryUsageFor(table: string): "PRODUCT" | "BANNER" {
  return VISUAL_TABLES.has(table) ? "BANNER" : "PRODUCT";
}

function parseHttps(value: string): URL | null {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" ? url : null;
}

/**
 * Adresse qu'un script peut demander : https, hôte nommé public (pas d'IP, pas de localhost, au
 * moins un point), ni port ni identifiants.
 */
export function isProbeableUrl(value: string): boolean {
  const url = parseHttps(value);
  if (url === null || url.port !== "" || url.username !== "" || url.password !== "") return false;
  const host = url.hostname.toLowerCase();
  if (host.startsWith("[") || /^[\d.]+$/.test(host)) return false;
  if (host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) return false;
  return true;
}

/** Source qu'une copie peut télécharger : Unsplash, Pexels, un magasin Blob, ou un hôte ajouté par --allow-host. */
export function isAllowedCopySource(value: string, extraHosts: readonly string[]): boolean {
  if (!isProbeableUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase();
  return (
    LEGACY_DISPLAY_HOSTS.includes(host) ||
    host.endsWith(BLOB_HOST_SUFFIX) ||
    extraHosts.some((extra) => extra.toLowerCase() === host)
  );
}

/** URL dont la source doit être sondée avant d'être copiée ou déclarée morte. */
export function needsSourceProbe(row: Pick<CensusRow, "kind" | "value">): boolean {
  const copyable =
    row.kind === "LEGACY_DISPLAY" || row.kind === "FOREIGN_BLOB" || row.kind === "OTHER";
  return copyable && parseHttps(row.value) !== null;
}

/**
 * Écrire n'est permis qu'avec le vrai magasin Blob, ou en répétition locale : base locale et
 * magasin sur disque. Renvoie null si permis, sinon l'explication en français.
 */
export function applyRefusal(
  storeKind: "blob" | "local",
  databaseUrl: string | undefined
): string | null {
  if (storeKind === "blob" || isLocalPostgresUrl(databaseUrl)) return null;
  return (
    "Écriture refusée : aucun BLOB_READ_WRITE_TOKEN n'est défini, les fichiers iraient sur le disque " +
    "de cette machine alors que la base n'est pas locale. Exportez le jeton Blob dans votre terminal, " +
    "ou répétez sur une base locale."
  );
}

function deadAction(row: CensusRow, reason: string): RepairAction {
  const column = imageColumnOf(row.table, row.column);
  if (column.nullable && column.nullWhenDead) return { action: "NULL", row, reason };
  return { action: "DECIDE", row, reason: `${reason} ; colonne sans repli à l'affichage` };
}

function probeFailure(probe: ProbeResult): string {
  const detail =
    probe.error ?? (probe.status === null ? "pas de réponse" : `statut ${probe.status}`);
  return `sonde en échec (${detail}) : à revérifier`;
}

type RowDecision = RepairAction | { action: "COPY_ROW" };

function decide(
  row: CensusRow,
  probes: ReadonlyMap<string, ProbeResult>,
  opts: PlanOptions
): RowDecision {
  const probe = probes.get(row.value);
  switch (row.kind) {
    case "BLOB":
      if (probe === undefined || probe.alive)
        return { action: "SKIP", row, reason: "photo de notre stockage" };
      if (probe.status !== null && GONE_STATUSES.has(probe.status)) {
        return deadAction(row, `fichier absent de notre stockage (${probe.status})`);
      }
      return { action: "DECIDE", row, reason: probeFailure(probe) };
    case "LOCAL_STATIC":
      return opts.localFileExists(row.value)
        ? { action: "SKIP", row, reason: "photo du site" }
        : { action: "DECIDE", row, reason: "photo du site absente de public/" };
    case "LOCAL_STORE":
      return { action: "SKIP", row, reason: "stockage local de développement" };
    case "EXPIRING":
      return deadAction(row, "lien Replicate, expiré au bout d'une heure");
    case "LEGACY_UPLOAD_PATH":
      return deadAction(row, "ancien chemin /api/uploads, supprimé en avril 2026");
    case "DATA":
      return { action: "DECIDE", row, reason: "image intégrée (data: ou blob:)" };
    case "LEGACY_DISPLAY":
    case "FOREIGN_BLOB":
    case "OTHER":
      if (!needsSourceProbe(row))
        return { action: "DECIDE", row, reason: "valeur inconnue (ni https, ni chemin du site)" };
      if (probe === undefined)
        return { action: "DECIDE", row, reason: "source non sondée : relancer avec la sonde" };
      if (!probe.alive) {
        if (probe.status !== null && GONE_STATUSES.has(probe.status)) {
          return deadAction(row, `source disparue (${probe.status})`);
        }
        return { action: "DECIDE", row, reason: probeFailure(probe) };
      }
      if (row.table === IMAGE_REGISTRY_TABLE) {
        return {
          action: "DECIDE",
          row,
          reason: "ligne du registre des images : à traiter avec la galerie",
        };
      }
      return { action: "COPY_ROW" };
  }
}

export function planRepairs(
  rows: readonly CensusRow[],
  probes: ReadonlyMap<string, ProbeResult>,
  opts: PlanOptions
): RepairAction[] {
  const actions: RepairAction[] = [];
  const copies = new Map<string, Extract<RepairAction, { action: "COPY" }>>();
  for (const row of rows) {
    const decision = decide(row, probes, opts);
    if (decision.action !== "COPY_ROW") {
      actions.push(decision);
      continue;
    }
    const key = `${row.value}\u0000${row.shopId ?? ""}`;
    const existing = copies.get(key);
    if (existing !== undefined) {
      existing.rows.push(row);
    } else {
      const copy = { action: "COPY" as const, rows: [row], source: row.value };
      copies.set(key, copy);
      actions.push(copy);
    }
  }
  return actions;
}
