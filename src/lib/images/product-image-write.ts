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
// Normalisation: order and primary by rankProductPhotos (rank.ts); orders rewritten 0..n-1; exactly
// one isPrimary; alt trimmed, empty → null.
// Mirror: images given and non-empty → imageUrl = primary url (clearImageUrl is irrelevant); images
// given and empty → null if clearImageUrl, null if the stored imageUrl was one of the stored images
// (it mirrored a photo now removed), on create the given imageUrl ?? null, otherwise imageUrl unchanged
// (an imageUrl-only product keeps its photo); images not given on a product that HAS stored images →
// its primary photo decides: a requested change of imageUrl (clearImageUrl, or an imageUrl other than
// the stored one) is refused with PRIMARY_PHOTO_DECIDES_FR, the stored value re-sent is a no-op;
// images not given otherwise (create, or a product without stored images) → null if clearImageUrl, the
// given imageUrl if defined, otherwise unchanged. images is "unchanged" when no list is given; imageUrl
// is "unchanged" when the request leaves the photos of an existing row as they are (no photo field, or
// the stored value re-sent on a product with photos), so that such a write never stores a value read
// before it. Otherwise the plan holds final values: never "unchanged" on a create (stored null) nor
// when a list is given, which then writes imageUrl together with the photos it mirrors.
//
// Précisions d'application : « together with imageUrl » = imageUrl est une chaîne (null n'est pas
// une contradiction) ; une imageUrl fournie est contrôlée par la règle d'écriture même quand le
// miroir ne l'utilise pas.
import { IMAGE_URL_REFUSED_FR, imageWriteRefusal } from "./durable-url";
import { rankProductPhotos } from "./rank";

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
  | {
      ok: true;
      imageUrl: string | null | "unchanged";
      images: NormalizedProductImage[] | "unchanged";
    };

interface NormalizedImages {
  images: NormalizedProductImage[];
  /** URL de la photo principale, null seulement pour une liste vide. */
  primaryUrl: string | null;
}

function normalizeImages(images: readonly ProductImageInput[]): NormalizedImages {
  const { photos, primary } = rankProductPhotos(images);
  return {
    images: photos.map((image, order) => {
      const alt = image.alt?.trim() ?? "";
      return { url: image.url, alt: alt === "" ? null : alt, order, isPrimary: image === primary };
    }),
    primaryUrl: primary?.url ?? null,
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
export function requestedImageValues(
  input: Pick<ProductImageWriteInput, "images" | "imageUrl">
): string[] {
  const values = (input.images ?? []).map((image) => image.url);
  if (typeof input.imageUrl === "string") values.push(input.imageUrl);
  return values;
}

/** imageUrl to store when an empty photo list is given. */
function mirrorWhenEmptied(
  stored: StoredProductPhotos | null,
  imageUrl: string | null | undefined,
  clearImageUrl: boolean
): string | null {
  if (clearImageUrl) return null;
  if (stored === null) return imageUrl ?? null;
  // An imageUrl that mirrored one of the removed photos goes with them.
  return stored.images.some((image) => image.url === stored.imageUrl) ? null : stored.imageUrl;
}

type MirrorDecision =
  | { ok: false; messageFr: string }
  | { ok: true; imageUrl: string | null | "unchanged" };

/** imageUrl when no photo list is given. */
function mirrorWithoutImages(
  stored: StoredProductPhotos | null,
  imageUrl: string | null | undefined,
  clearImageUrl: boolean
): MirrorDecision {
  const requested = clearImageUrl ? null : imageUrl;
  if (stored === null) return { ok: true, imageUrl: requested ?? null };
  if (requested === undefined) return { ok: true, imageUrl: "unchanged" };
  if (stored.images.length === 0) return { ok: true, imageUrl: requested };
  // A product with photos keeps imageUrl as the mirror of its primary photo.
  return requested === stored.imageUrl
    ? { ok: true, imageUrl: "unchanged" }
    : { ok: false, messageFr: PRIMARY_PHOTO_DECIDES_FR };
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

  if (normalized === undefined) {
    const decision = mirrorWithoutImages(stored, imageUrl, clearImageUrl);
    if (!decision.ok) return decision;
    return { ok: true, imageUrl: decision.imageUrl, images: "unchanged" };
  }
  return {
    ok: true,
    imageUrl: normalized.primaryUrl ?? mirrorWhenEmptied(stored, imageUrl, clearImageUrl),
    images: normalized.images,
  };
}
