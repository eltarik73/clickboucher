// src/lib/images/rank.ts — Order of a product's photos and which one is primary.
//
// Pure, browser and server. The one rule behind the server write plan (product-image-write.ts),
// the storefront photo (product-photo.ts) and the butcher's photo tiles (photos-state.ts).
// scripts/images/backfill-image-url.sql states it in SQL for stored rows;
// tests/integration/images/backfill-image-url.test.ts checks both pick the same photo.

export interface RankablePhoto {
  url: string;
  order?: number | null;
  isPrimary?: boolean | null;
}

/**
 * De-duplicates by URL (the first occurrence in input order wins), then sorts by order, a missing
 * order counting as the photo's position, ties kept in position order. Primary: the first photo
 * flagged isPrimary in that order, otherwise the first photo; null for an empty list.
 */
export function rankProductPhotos<T extends RankablePhoto>(
  images: readonly T[]
): { photos: T[]; primary: T | null } {
  const seen = new Set<string>();
  const unique = images.filter((image) => {
    if (seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
  const photos = unique
    .map((image, position) => ({ image, position, rank: image.order ?? position }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((entry) => entry.image);
  if (photos.length === 0) return { photos, primary: null };
  return { photos, primary: photos.find((image) => image.isPrimary === true) ?? photos[0] };
}
