// src/lib/images/ingest.ts — Enregistrer une image : persistImage, seul chemin d'écriture d'un
// fichier d'image (envoi depuis un formulaire, source d'une retouche, réparation des données).
//
// Ordre, et ce qu'il garantit :
// 1. plafond de taille, puis décodage et réencodage (process.ts) : un fichier refusé ne laisse
//    rien, ni fichier, ni ligne ;
// 2. la photo, puis la vignette, sous un nom neuf (UUID) ; si la vignette échoue, la photo est
//    effacée ;
// 3. les deux URL doivent être durables et la vignette doit se déduire de la photo
//    (thumbnailOf) ; sinon les deux fichiers sont effacés ;
// 4. la ligne de generated_images n'est écrite qu'ensuite, toutes colonnes obligatoires remplies ;
//    si elle échoue, les deux fichiers sont effacés et l'erreur d'origine remonte.
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isDurableImageUrl } from "./durable-url";
import { ImageRejectedError, StoreUnavailableError } from "./errors";
import { processImage } from "./process";
import { getImageStore, type ImageStore } from "./store";
import { imagePathnames, thumbnailOf } from "./thumbnail";

export interface ImageOwner {
  shopId: string | null;
  createdBy: string;
}

export interface RegistryInfo {
  model: string;
  prompt: string;
  usage: string;
  metadata?: Prisma.InputJsonValue;
}

export interface RegistryRow extends RegistryInfo {
  imageUrl: string;
  width: number;
  height: number;
  shopId: string | null;
  createdBy: string;
}

export interface ImageRegistry {
  create(row: RegistryRow): Promise<{ id: string }>;
}

export interface IngestDeps {
  store: ImageStore;
  registry: ImageRegistry;
}

export interface PersistImageInput {
  bytes: Uint8Array;
  owner: ImageOwner;
  registry: RegistryInfo;
  maxBytes: number;
  /** Dossier du fichier dans le magasin ; par défaut l'usage du registre (« product », …). */
  folder?: string;
}

export interface PersistedImage {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

/** Plafond des sources que le serveur télécharge lui-même (réparation, sorties de génération). */
export const FETCHED_SOURCE_MAX_BYTES = 12 * 1024 * 1024;

const WEBP = "image/webp" as const;

export const prismaImageRegistry: ImageRegistry = {
  create: (row) =>
    prisma.generatedImage.create({
      data: {
        model: row.model,
        prompt: row.prompt,
        usage: row.usage,
        metadata: row.metadata,
        imageUrl: row.imageUrl,
        width: row.width,
        height: row.height,
        shopId: row.shopId,
        createdBy: row.createdBy,
      },
      select: { id: true },
    }),
};

function hostOf(url: string): string {
  if (url.startsWith("/")) return "(local)";
  try {
    return new URL(url).host;
  } catch {
    return "(invalide)";
  }
}

/** Efface des fichiers déjà écrits pendant un échec : un échec d'effacement est journalisé, l'échec d'origine reste celui qu'on remonte. */
async function removeWritten(store: ImageStore, urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    try {
      await store.del(url);
    } catch (error) {
      logger.warn("[images] fichier orphelin après un échec d'enregistrement", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function putOrUnavailable(
  store: ImageStore,
  pathname: string,
  bytes: Uint8Array
): Promise<{ url: string }> {
  try {
    return await store.put(pathname, bytes, WEBP);
  } catch (error) {
    logger.error("[images] écriture refusée par le stockage", {
      store: store.kind,
      pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new StoreUnavailableError(error);
  }
}

export async function persistImage(input: PersistImageInput, deps?: IngestDeps): Promise<PersistedImage> {
  if (input.bytes.byteLength > input.maxBytes) throw new ImageRejectedError("TOO_LARGE");
  const { store, registry } = deps ?? { store: getImageStore(), registry: prismaImageRegistry };

  const image = await processImage(input.bytes);
  const paths = imagePathnames(
    { shopId: input.owner.shopId },
    input.folder ?? input.registry.usage,
    randomUUID()
  );

  const master = await putOrUnavailable(store, paths.master, image.master);
  let thumb: { url: string };
  try {
    thumb = await putOrUnavailable(store, paths.thumb, image.thumb);
  } catch (error) {
    await removeWritten(store, [master.url]);
    throw error;
  }

  const written = [master.url, thumb.url];
  if (!isDurableImageUrl(master.url) || !isDurableImageUrl(thumb.url) || thumbnailOf(master.url) !== thumb.url) {
    await removeWritten(store, written);
    logger.error("[images] URL rendue par le stockage inattendue", {
      store: store.kind,
      masterHost: hostOf(master.url),
      thumbHost: hostOf(thumb.url),
    });
    throw new StoreUnavailableError();
  }

  let row: { id: string };
  try {
    row = await registry.create({
      ...input.registry,
      imageUrl: master.url,
      width: image.width,
      height: image.height,
      shopId: input.owner.shopId,
      createdBy: input.owner.createdBy,
    });
  } catch (error) {
    await removeWritten(store, written);
    throw error;
  }

  return { id: row.id, url: master.url, thumbUrl: thumb.url, width: image.width, height: image.height };
}
