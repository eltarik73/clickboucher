// src/lib/images/store.ts — Où les fichiers d'image sont écrits et effacés. Seul adaptateur de
// stockage (garde : tests/lib/image-writers-guard.test.ts).
//
// Choix du stockage, une seule règle (getImageStore) :
// - BLOB_READ_WRITE_TOKEN présent → Vercel Blob, sous un nom que nous choisissons (pas de suffixe
//   aléatoire), mis en cache un an : un nom de fichier n'est jamais réécrit.
// - sinon, hors Vercel et hors production → disque local (.image-store/, ignoré par git), servi par
//   la route /local-images. C'est le stockage du développement et de la CI.
// - sinon (Vercel sans jeton) → StoreUnavailableError (503). Jamais de repli sur le disque.
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { isProductionDeployment } from "@/lib/auth/test-mode-env";
import { logger } from "@/lib/logger";
import { classifyImageUrl, isStoreImageUrl } from "./durable-url";
import { StoreUnavailableError } from "./errors";
import { thumbnailOf } from "./thumbnail";

export interface ImageStore {
  readonly kind: "blob" | "local";
  put(pathname: string, bytes: Uint8Array, contentType: "image/webp"): Promise<{ url: string }>;
  del(url: string): Promise<void>;
}

const ONE_YEAR_SECONDS = 31_536_000;
const LOCAL_IMAGES_PREFIX = "/local-images/";

const DIRECTORY_SEGMENT = /^[a-z0-9_-]+$/;
const FILE_SEGMENT = /^[a-z0-9_-]+\.webp$/;

/** Le disque local n'est permis ni sur Vercel, ni en production, ni quand un jeton Blob existe. */
export function localStoreAllowed(): boolean {
  return !process.env.VERCEL && !isProductionDeployment() && !process.env.BLOB_READ_WRITE_TOKEN;
}

export function localStoreRoot(): string {
  return process.env.IMAGE_LOCAL_STORE_DIR || path.join(process.cwd(), ".image-store");
}

/**
 * Fichier du magasin local pour un chemin découpé (« shops », « <id>, « product », « <uuid>.webp ») :
 * des dossiers [a-z0-9_-], un fichier .webp, au moins un dossier, et le résultat reste dans la
 * racine. Tout autre chemin (« .. », majuscules, points, vide) donne null.
 */
export function localStoreFile(segments: readonly string[]): string | null {
  if (segments.length < 2) return null;
  const folders = segments.slice(0, -1);
  const fileName = segments[segments.length - 1];
  if (!folders.every((segment) => DIRECTORY_SEGMENT.test(segment))) return null;
  if (!FILE_SEGMENT.test(fileName)) return null;
  const root = path.resolve(localStoreRoot());
  const file = path.resolve(root, ...segments);
  return file.startsWith(root + path.sep) ? file : null;
}

class BlobStore implements ImageStore {
  readonly kind = "blob" as const;

  async put(
    pathname: string,
    bytes: Uint8Array,
    contentType: "image/webp"
  ): Promise<{ url: string }> {
    const blob = await put(pathname, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: ONE_YEAR_SECONDS,
    });
    return { url: blob.url };
  }

  async del(url: string): Promise<void> {
    if (classifyImageUrl(url) !== "BLOB") {
      throw new Error(
        "Suppression refusée : l'URL n'appartient pas au magasin Blob de la plateforme"
      );
    }
    await del(url);
  }
}

class LocalDiskStore implements ImageStore {
  readonly kind = "local" as const;

  async put(pathname: string, bytes: Uint8Array): Promise<{ url: string }> {
    const file = localStoreFile(pathname.split("/"));
    if (file === null)
      throw new Error(`Chemin d'image local invalide : ${JSON.stringify(pathname)}`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return { url: `${LOCAL_IMAGES_PREFIX}${pathname}` };
  }

  async del(url: string): Promise<void> {
    const file = url.startsWith(LOCAL_IMAGES_PREFIX)
      ? localStoreFile(url.slice(LOCAL_IMAGES_PREFIX.length).split("/"))
      : null;
    if (file === null)
      throw new Error("Suppression refusée : l'URL n'appartient pas au magasin local");
    try {
      await unlink(file);
    } catch (error) {
      // Fichier déjà absent : l'état voulu est atteint.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export function getImageStore(): ImageStore {
  if (process.env.BLOB_READ_WRITE_TOKEN) return new BlobStore();
  if (localStoreAllowed()) return new LocalDiskStore();
  logger.error("[images] aucun stockage", { vercelEnv: process.env.VERCEL_ENV ?? null });
  throw new StoreUnavailableError();
}

/** The files of our store behind an image URL: the photo and its thumbnail; none for a foreign URL. */
export function storedFilesOf(url: string): string[] {
  if (!isStoreImageUrl(url)) return [];
  const thumb = thumbnailOf(url);
  return thumb === null ? [url] : [url, thumb];
}

/**
 * Deletes files the caller no longer needs (a failed write, a removed image). A failed deletion
 * leaves a harmless orphan: it is logged with the caller's context, never thrown.
 */
export async function deleteFilesQuietly(
  store: ImageStore,
  urls: readonly string[],
  context: string
): Promise<void> {
  for (const url of urls) {
    try {
      await store.del(url);
    } catch (error) {
      logger.warn("[images] fichier non effacé", {
        context,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
