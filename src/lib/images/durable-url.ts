// src/lib/images/durable-url.ts — Quelles URL d'image peut-on enregistrer, lesquelles afficher.
//
// Module pur, utilisable dans le navigateur et sur le serveur. Seule autorité de la règle :
// - DURABLE : notre magasin Blob (hôte épinglé), une photo du site sous /img/(products|shops|recipes)/,
//   ou le magasin local /local-images/... hors production Vercel (développement et CI).
// - AFFICHABLE : durable, ou un hôte historique toléré pour l'affichage seulement (Unsplash, Pexels)
//   en attendant la réparation décidée par le propriétaire.
// - ÉCRITURE : une nouvelle valeur doit être durable et, pour un fichier de notre magasin, appartenir
//   au périmètre de la ligne (sa boutique ou la plateforme : write-scope.ts fournit cet ensemble) ;
//   une valeur déjà enregistrée sur la même ligne est acceptée telle quelle (droit acquis), pour
//   qu'un réenregistrement ne casse jamais.
// Les URL replicate.delivery expirent en une heure : jamais durables, jamais affichées.
import { z } from "zod";
import { isProductionDeployment } from "@/lib/auth/test-mode-env";

export const DEFAULT_IMAGE_BLOB_HOST = "nzqbbcqekyom7ajd.public.blob.vercel-storage.com";

/** Hôte du magasin Blob de la plateforme. Variable publique, figée au build : client et serveur s'accordent. */
export function imageBlobHost(): string {
  return (process.env.NEXT_PUBLIC_IMAGE_BLOB_HOST || DEFAULT_IMAGE_BLOB_HOST).toLowerCase();
}

export const LEGACY_DISPLAY_HOSTS: readonly string[] = ["images.unsplash.com", "images.pexels.com"];

export type ImageUrlKind =
  | "BLOB"
  | "LOCAL_STATIC"
  | "LOCAL_STORE"
  | "LEGACY_DISPLAY"
  | "EXPIRING"
  | "FOREIGN_BLOB"
  | "LEGACY_UPLOAD_PATH"
  | "DATA"
  | "OTHER";

const MAX_IMAGE_URL_LENGTH = 2048;
const LOCAL_STATIC_PATH = /^\/img\/(products|shops|recipes)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/;
const LOCAL_STORE_PATH = /^\/local-images\/(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.webp$/;
const LEGACY_UPLOAD_PREFIX = "/api/uploads/";
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const EXPIRING_HOST = "replicate.delivery";

/** Espace (Unicode compris) ou caractère de contrôle C0 / DEL / C1. */
function hasUnsafeCharacter(value: string): boolean {
  if (/\s/.test(value)) return true;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function parseAbsolute(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Forme canonique stricte d'un fichier de notre magasin : https, hôte épinglé, ni identifiants, ni port, ni requête, ni ancre. */
function isPinnedBlobUrl(url: URL, value: string): boolean {
  return (
    url.protocol === "https:" &&
    url.hostname === imageBlobHost() &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    !value.includes("?") &&
    !value.includes("#") &&
    url.pathname.length > 1 &&
    url.href === value
  );
}

export function classifyImageUrl(value: string): ImageUrlKind {
  if (value.length > MAX_IMAGE_URL_LENGTH || hasUnsafeCharacter(value)) return "OTHER";
  if (LOCAL_STATIC_PATH.test(value)) return "LOCAL_STATIC";
  if (LOCAL_STORE_PATH.test(value)) return "LOCAL_STORE";
  if (value.startsWith(LEGACY_UPLOAD_PREFIX)) return "LEGACY_UPLOAD_PATH";
  // Tout autre chemin relatif (« /img/../x », « //hôte/x », …) est inconnu.
  if (value.startsWith("/")) return "OTHER";

  const url = parseAbsolute(value);
  if (url === null) return "OTHER";
  if (url.protocol === "data:" || url.protocol === "blob:") return "DATA";

  const host = url.hostname;
  if (host === EXPIRING_HOST || host.endsWith(`.${EXPIRING_HOST}`)) return "EXPIRING";
  if (url.protocol !== "https:") return "OTHER";
  if (isPinnedBlobUrl(url, value)) return "BLOB";
  if (LEGACY_DISPLAY_HOSTS.includes(host)) return "LEGACY_DISPLAY";
  if (host.endsWith(BLOB_HOST_SUFFIX) && host !== imageBlobHost()) return "FOREIGN_BLOB";
  return "OTHER";
}

export function isDurableImageUrl(value: string): boolean {
  const kind = classifyImageUrl(value);
  if (kind === "BLOB" || kind === "LOCAL_STATIC") return true;
  return kind === "LOCAL_STORE" && !isProductionDeployment();
}

export function isDisplayableImageUrl(value: string): boolean {
  return isDurableImageUrl(value) || classifyImageUrl(value) === "LEGACY_DISPLAY";
}

/** Un fichier de notre magasin (Blob épinglé, ou magasin local) : il a un propriétaire. */
export function isStoreImageUrl(value: string): boolean {
  const kind = classifyImageUrl(value);
  return kind === "BLOB" || kind === "LOCAL_STORE";
}

export const IMAGE_URL_REFUSED_FR =
  "Photo refusée : utilisez une photo envoyée depuis Klik&Go ou une photo du catalogue du site.";

export interface ImageWriteContext {
  /** Valeurs déjà enregistrées sur la ligne (droit acquis, égalité exacte). */
  stored: ReadonlySet<string>;
  /** Fichiers de notre magasin qui appartiennent au périmètre de la ligne (storeUrlsInScope). */
  inScope: ReadonlySet<string>;
}

/**
 * Règle d'écriture : null si la valeur est déjà enregistrée sur la ligne, ou si elle est durable et,
 * pour un fichier de notre magasin, dans le périmètre de la ligne ; sinon le message de refus.
 * Une photo du site (/img/...) n'appartient à personne : elle est toujours acceptée.
 */
export function imageWriteRefusal(value: string, context: ImageWriteContext): string | null {
  if (context.stored.has(value)) return null;
  if (!isDurableImageUrl(value)) return IMAGE_URL_REFUSED_FR;
  if (isStoreImageUrl(value) && !context.inScope.has(value)) return IMAGE_URL_REFUSED_FR;
  return null;
}

/** Forme seulement : la règle d'écriture (droit acquis, périmètre) s'applique ensuite dans la route. */
export const imageRefSchema: z.ZodString = z.string().trim().min(1).max(MAX_IMAGE_URL_LENGTH);
