// src/lib/images/thumbnail.ts — Noms des fichiers stockés et URL de la vignette.
//
// Module pur. Chaque image stockée par la plateforme a deux fichiers WebP : la photo
// (« <uuid>.webp », 2048 px au plus) et sa vignette (« <uuid>-t.webp », 400 px au plus).
// La vignette se déduit de l'URL : aucune colonne n'est nécessaire. Les anciens fichiers
// (nommés autrement) n'ont pas de vignette : thumbnailOf renvoie null et l'on affiche la photo.
import { classifyImageUrl } from "./durable-url";

export const THUMB_SUFFIX = "-t";

export interface ImagePathnames {
  id: string;
  master: string;
  thumb: string;
}

const PATH_SEGMENT = /^[a-z0-9-]+$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const WEBP_EXTENSION = ".webp";

/**
 * Chemins dans le magasin : « shops/<shopId>/<usage>/<id>.webp » pour une boutique,
 * « platform/<usage>/<id>.webp » pour la plateforme, et la vignette « <id>-t.webp » à côté.
 * Refuse tout segment hors [a-z0-9-] : aucun chemin ne peut sortir de son dossier.
 */
export function imagePathnames(scope: { shopId: string | null }, usage: string, id: string): ImagePathnames {
  const segment = usage.toLowerCase().replace(/_/g, "-");
  if (!PATH_SEGMENT.test(id)) throw new Error(`Identifiant d'image invalide : ${JSON.stringify(id)}`);
  if (!PATH_SEGMENT.test(segment)) throw new Error(`Usage d'image invalide : ${JSON.stringify(usage)}`);
  if (scope.shopId !== null && !PATH_SEGMENT.test(scope.shopId)) {
    throw new Error(`Identifiant de boutique invalide : ${JSON.stringify(scope.shopId)}`);
  }
  const folder = scope.shopId === null ? `platform/${segment}` : `shops/${scope.shopId}/${segment}`;
  return {
    id,
    master: `${folder}/${id}${WEBP_EXTENSION}`,
    thumb: `${folder}/${id}${THUMB_SUFFIX}${WEBP_EXTENSION}`,
  };
}

/** URL de la vignette d'une image de notre magasin (Blob ou local) nommée « <uuid v4>.webp », sinon null. */
export function thumbnailOf(url: string): string | null {
  const kind = classifyImageUrl(url);
  if (kind !== "BLOB" && kind !== "LOCAL_STORE") return null;
  const fileName = url.slice(url.lastIndexOf("/") + 1);
  if (!fileName.endsWith(WEBP_EXTENSION)) return null;
  const stem = fileName.slice(0, -WEBP_EXTENSION.length);
  if (!UUID_V4.test(stem)) return null;
  return `${url.slice(0, -WEBP_EXTENSION.length)}${THUMB_SUFFIX}${WEBP_EXTENSION}`;
}
