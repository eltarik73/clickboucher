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
import { deleteFilesQuietly, getImageStore, type ImageStore } from "./store";
import { imagePathnames, thumbnailOf } from "./thumbnail";

export interface ImageOwner {
  shopId: string | null;
  createdBy: string;
}

interface RegistryInfo {
  model: string;
  prompt: string;
  usage: string;
  metadata?: Prisma.InputJsonValue;
}

export interface PersistImageInput {
  bytes: Uint8Array;
  owner: ImageOwner;
  registry: RegistryInfo;
  maxBytes: number;
  /** Dossier du fichier dans le magasin : le type d'envoi (« product », « retouch-source »…) ou « repair ». */
  folder: string;
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
const ORPHAN_CONTEXT = "fichier orphelin après un échec d'enregistrement";

function hostOf(url: string): string {
  if (url.startsWith("/")) return "(local)";
  try {
    return new URL(url).host;
  } catch {
    return "(invalide)";
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

export async function persistImage(
  input: PersistImageInput,
  store: ImageStore = getImageStore()
): Promise<PersistedImage> {
  if (input.bytes.byteLength > input.maxBytes) throw new ImageRejectedError("TOO_LARGE");

  const image = await processImage(input.bytes);
  const paths = imagePathnames({ shopId: input.owner.shopId }, input.folder, randomUUID());

  const master = await putOrUnavailable(store, paths.master, image.master);
  let thumb: { url: string };
  try {
    thumb = await putOrUnavailable(store, paths.thumb, image.thumb);
  } catch (error) {
    await deleteFilesQuietly(store, [master.url], ORPHAN_CONTEXT);
    throw error;
  }

  const written = [master.url, thumb.url];
  if (
    !isDurableImageUrl(master.url) ||
    !isDurableImageUrl(thumb.url) ||
    thumbnailOf(master.url) !== thumb.url
  ) {
    await deleteFilesQuietly(store, written, ORPHAN_CONTEXT);
    logger.error("[images] URL rendue par le stockage inattendue", {
      store: store.kind,
      masterHost: hostOf(master.url),
      thumbHost: hostOf(thumb.url),
    });
    throw new StoreUnavailableError();
  }

  let row: { id: string };
  try {
    row = await prisma.generatedImage.create({
      data: {
        model: input.registry.model,
        prompt: input.registry.prompt,
        usage: input.registry.usage,
        metadata: input.registry.metadata,
        imageUrl: master.url,
        width: image.width,
        height: image.height,
        shopId: input.owner.shopId,
        createdBy: input.owner.createdBy,
      },
      select: { id: true },
    });
  } catch (error) {
    await deleteFilesQuietly(store, written, ORPHAN_CONTEXT);
    throw error;
  }

  return {
    id: row.id,
    url: master.url,
    thumbUrl: thumb.url,
    width: image.width,
    height: image.height,
  };
}
