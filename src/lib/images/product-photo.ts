// src/lib/images/product-photo.ts — Quelle photo afficher pour un produit ou une boutique.
//
// Module pur, utilisé par les composants ProductPhoto / ShopPhoto dans le navigateur.
// Il renvoie une liste ordonnée de candidates : d'abord les photos propres (photo principale,
// puis Product.imageUrl), uniquement si elles sont affichables (isDisplayableImageUrl), puis
// UNE photo locale du site qui ne manque jamais. Les URL qui expirent (replicate.delivery),
// data:, blob:, les hôtes inconnus, les autres magasins Blob et les anciens chemins
// /api/uploads n'apparaissent jamais : l'affichage ne les demande donc pas.
import {
  DEFAULT_PRODUCT_PHOTO,
  SHOP_IMAGES,
  categoryProductPhoto,
  keywordProductPhoto,
} from "@/lib/product-images";
import { isDisplayableImageUrl } from "./durable-url";

export interface ProductPhotoImage {
  url: string;
  isPrimary?: boolean | null;
  order?: number | null;
}

export interface ProductPhotoSource {
  images?: readonly ProductPhotoImage[] | null;
  imageUrl?: string | null;
  name: string;
  category?: string | null;
}

export interface ShopPhotoSource {
  id: string;
  imageUrl?: string | null;
}

export interface ResolvedPhoto {
  /** Première photo propre affichable, ou null (le produit n'a que la photo locale). */
  own: string | null;
  /** Jamais vide ; photos propres d'abord ; la dernière est une photo locale /img. */
  candidates: readonly string[];
}

/** Photo principale : la première marquée isPrimary dans l'ordre (order, position), sinon la première dans cet ordre. */
export function primaryImageOf<T extends ProductPhotoImage>(images: readonly T[]): T | null {
  const ranked = images
    .map((image, index) => ({ image, index, rank: image.order ?? index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.image);
  if (ranked.length === 0) return null;
  return ranked.find((image) => image.isPrimary === true) ?? ranked[0];
}

function resolve(ownValues: readonly (string | null | undefined)[], localPhoto: string): ResolvedPhoto {
  const own = ownValues.filter(
    (value): value is string => typeof value === "string" && isDisplayableImageUrl(value)
  );
  const candidates = Array.from(new Set([...own, localPhoto]));
  return { own: own.length > 0 ? own[0] : null, candidates };
}

export function resolveProductPhoto(src: ProductPhotoSource): ResolvedPhoto {
  const primary = src.images ? primaryImageOf(src.images) : null;
  const localPhoto =
    keywordProductPhoto(src.name) ?? categoryProductPhoto(src.category ?? "") ?? DEFAULT_PRODUCT_PHOTO;
  return resolve([primary?.url, src.imageUrl], localPhoto);
}

export function resolveShopPhoto(src: ShopPhotoSource): ResolvedPhoto {
  return resolve([src.imageUrl], shopFallbackPhoto(src.id));
}

/** FNV-1a 32 bits, non signé, sur les octets UTF-8. */
function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Photo de boutique locale, stable pour un même identifiant (et non plus selon la position dans une liste). */
export function shopFallbackPhoto(shopId: string): string {
  return SHOP_IMAGES[fnv1a32(shopId) % SHOP_IMAGES.length];
}
