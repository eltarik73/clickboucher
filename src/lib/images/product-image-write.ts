// src/lib/images/product-image-write.ts — Plan d'écriture des photos d'un produit.
//
// Module pur : le SEUL endroit où se décide le miroir Product.imageUrl. Les routes produit
// (création, modification, duplication) appliquent le plan tel quel, par planProductImageWriteInShop
// (write-scope.ts), qui fournit inScope.
//
// Décision D5 du chantier C1-PHOTOS-A, avec le périmètre des fichiers de notre magasin et la règle
// « la photo principale fait foi » :
// Refusals: clearImageUrl together with imageUrl → « Choisissez : retirer la photo ou en indiquer une,
// pas les deux. »; more than MAX_PRODUCT_PHOTOS = 5 images after de-duplication → « 5 photos maximum
// par produit. »; any new value failing imageWriteRefusal (durable, and for a file of our store, in the
// row's scope: inScope) → IMAGE_URL_REFUSED_FR.
// Normalisation: de-duplicate by url keeping the first; stable sort by (order ?? index); orders
// rewritten 0..n-1; exactly one isPrimary (the first flagged, else index 0); alt trimmed, empty → null.
// Mirror: images given and non-empty → imageUrl = primary url (clearImageUrl is irrelevant); images
// given and empty → null if clearImageUrl, null if the stored imageUrl was one of the stored images
// (it mirrored a photo now removed), on create the given imageUrl ?? null, otherwise imageUrl unchanged
// (an imageUrl-only product keeps its photo); images not given on a product that HAS stored images →
// its primary photo decides: a requested change of imageUrl (clearImageUrl, or an imageUrl other than
// the stored one) is refused with PRIMARY_PHOTO_DECIDES_FR, the stored value re-sent is a no-op;
// images not given otherwise (create, or a product without stored images) → null if clearImageUrl, the
// given imageUrl if defined, otherwise unchanged. A missing key in the plan means 'leave as is'.
//
// Précisions d'application : « together with imageUrl » = imageUrl est une chaîne (null n'est pas
// une contradiction) ; « index » = position après dédoublonnage ; la première image marquée l'est
// dans l'ordre trié ; une imageUrl fournie est contrôlée par la règle d'écriture même quand le
// miroir ne l'utilise pas.
import { IMAGE_URL_REFUSED_FR, imageWriteRefusal } from "./durable-url";

export const MAX_PRODUCT_PHOTOS = 5;

export const CLEAR_AND_SET_IMAGE_REFUSED_FR =
  "Choisissez : retirer la photo ou en indiquer une, pas les deux.";
export const TOO_MANY_PRODUCT_PHOTOS_FR = `${MAX_PRODUCT_PHOTOS} photos maximum par produit.`;
export const PRIMARY_PHOTO_DECIDES_FR =
  "La photo principale du produit fait foi : modifiez les photos du produit.";

export interface ProductImageInput {
  url: string;
  alt?: string | null;
  order?: number;
  isPrimary?: boolean;
}

export interface NormalizedProductImage {
  url: string;
  alt: string | null;
  order: number;
  isPrimary: boolean;
}

export interface StoredProductPhotos {
  imageUrl: string | null;
  images: readonly { url: string }[];
}

export interface ProductImageWriteInput {
  stored: StoredProductPhotos | null;
  images?: readonly ProductImageInput[];
  imageUrl?: string | null;
  clearImageUrl?: boolean;
  /** Fichiers de notre magasin qui appartiennent au périmètre du produit (storeUrlsInScope). */
  inScope: ReadonlySet<string>;
}

export type ProductImageWritePlan =
  | { ok: false; messageFr: string }
  | { ok: true; images?: NormalizedProductImage[]; imageUrl?: string | null };

interface NormalizedImages {
  images: NormalizedProductImage[];
  /** URL de la photo principale, null seulement pour une liste vide. */
  primaryUrl: string | null;
}

function normalizeImages(images: readonly ProductImageInput[]): NormalizedImages {
  const seen = new Set<string>();
  const unique = images.filter((image) => {
    if (seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
  const sorted = unique
    .map((image, index) => ({ image, index, rank: image.order ?? index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.image);
  if (sorted.length === 0) return { images: [], primaryUrl: null };
  const flagged = sorted.findIndex((image) => image.isPrimary === true);
  const primaryIndex = flagged === -1 ? 0 : flagged;
  return {
    images: sorted.map((image, order) => {
      const alt = image.alt?.trim() ?? "";
      return { url: image.url, alt: alt === "" ? null : alt, order, isPrimary: order === primaryIndex };
    }),
    primaryUrl: sorted[primaryIndex].url,
  };
}

/** Valeurs déjà enregistrées sur la ligne : imageUrl et les URL de ses photos. */
export function storedImageValues(stored: StoredProductPhotos | null): Set<string> {
  const values = new Set<string>();
  if (stored === null) return values;
  if (stored.imageUrl !== null) values.add(stored.imageUrl);
  for (const image of stored.images) values.add(image.url);
  return values;
}

/** Valeurs demandées par l'écriture : URL des photos fournies, puis imageUrl si c'est une chaîne. */
export function requestedImageValues(input: Pick<ProductImageWriteInput, "images" | "imageUrl">): string[] {
  const values = (input.images ?? []).map((image) => image.url);
  if (typeof input.imageUrl === "string") values.push(input.imageUrl);
  return values;
}

/** imageUrl à écrire quand des images sont fournies mais vides ; undefined = inchangée. */
function mirrorWhenEmptied(
  stored: StoredProductPhotos | null,
  imageUrl: string | null | undefined,
  clearImageUrl: boolean
): string | null | undefined {
  if (clearImageUrl) return null;
  if (stored === null) return imageUrl ?? null;
  const mirroredRemovedPhoto =
    stored.imageUrl !== null && stored.images.some((image) => image.url === stored.imageUrl);
  return mirroredRemovedPhoto ? null : undefined;
}

type MirrorDecision = { ok: false; messageFr: string } | { ok: true; imageUrl: string | null | undefined };

/** imageUrl à écrire quand aucune liste d'images n'est fournie ; undefined = inchangée. */
function mirrorWithoutImages(
  stored: StoredProductPhotos | null,
  imageUrl: string | null | undefined,
  clearImageUrl: boolean
): MirrorDecision {
  const requested = clearImageUrl ? null : imageUrl;
  if (stored === null || stored.images.length === 0) return { ok: true, imageUrl: requested };
  // Le produit a des photos : imageUrl reste le miroir de sa principale.
  if (requested === undefined || requested === stored.imageUrl) return { ok: true, imageUrl: undefined };
  return { ok: false, messageFr: PRIMARY_PHOTO_DECIDES_FR };
}

export function planProductImageWrite(input: ProductImageWriteInput): ProductImageWritePlan {
  const { stored, images, imageUrl, inScope } = input;
  const clearImageUrl = input.clearImageUrl === true;
  if (clearImageUrl && typeof imageUrl === "string") {
    return { ok: false, messageFr: CLEAR_AND_SET_IMAGE_REFUSED_FR };
  }

  const normalized = images === undefined ? undefined : normalizeImages(images);
  if (normalized !== undefined && normalized.images.length > MAX_PRODUCT_PHOTOS) {
    return { ok: false, messageFr: TOO_MANY_PRODUCT_PHOTOS_FR };
  }

  const context = { stored: storedImageValues(stored), inScope };
  const newValues = requestedImageValues({ images: normalized?.images, imageUrl });
  if (newValues.some((value) => imageWriteRefusal(value, context) !== null)) {
    return { ok: false, messageFr: IMAGE_URL_REFUSED_FR };
  }

  let nextImageUrl: string | null | undefined;
  if (normalized === undefined) {
    const decision = mirrorWithoutImages(stored, imageUrl, clearImageUrl);
    if (!decision.ok) return decision;
    nextImageUrl = decision.imageUrl;
  } else if (normalized.primaryUrl !== null) {
    nextImageUrl = normalized.primaryUrl;
  } else {
    nextImageUrl = mirrorWhenEmptied(stored, imageUrl, clearImageUrl);
  }

  return {
    ok: true,
    ...(normalized === undefined ? {} : { images: normalized.images }),
    ...(nextImageUrl === undefined ? {} : { imageUrl: nextImageUrl }),
  };
}
