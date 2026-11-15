// Shop cards of the public list pages (city, district, department, Sunday, product x city,
// occasion x city, home, store finder): the columns a ShopCard shows, a neutral order, and the
// verified rating of each shop (src/lib/reviews/verified-rating.ts), loaded for the whole list in
// one grouped query. Shop.rating and Shop.ratingCount are never selected: the demo shops carry
// seeded figures, and the lists used to print them and to rank the shops by them.
import type { Prisma } from "@prisma/client";
import type { RatingSummary } from "@/lib/reviews/rating";
import { loadVerifiedRatings } from "@/lib/reviews/verified-rating";
import type { OpeningHours } from "@/lib/shop-hours";

/** What a ShopCard shows. A page that needs more (coordinates, phone) adds its own columns. */
export const shopCardSelect = {
  id: true,
  slug: true,
  name: true,
  address: true,
  city: true,
  imageUrl: true,
  prepTimeMin: true,
  busyMode: true,
  busyExtraMin: true,
  status: true,
  openingHours: true,
} as const satisfies Prisma.ShopSelect;

/** Alphabetical, then by id for a stable order: no ranking by a rating. */
export function shopCardOrderBy(): Prisma.ShopOrderByWithRelationInput[] {
  return [{ name: "asc" }, { id: "asc" }];
}

type ShopCardRow = { id: string; openingHours: Prisma.JsonValue };

export type ShopCardOf<T extends ShopCardRow> = Omit<T, "openingHours"> & {
  openingHours: OpeningHours | null;
  /** Verified rating, null when the shop has no verified review. */
  verifiedRating: RatingSummary | null;
};

/** The rows as ShopCard data, each with its verified rating (one query for the whole list). */
export async function toShopCards<T extends ShopCardRow>(rows: T[]): Promise<ShopCardOf<T>[]> {
  const ratings = await loadVerifiedRatings(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    // Shop.openingHours is the JSON written by the shop settings, keyed by French day names.
    openingHours: (row.openingHours as OpeningHours | null) ?? null,
    verifiedRating: ratings.get(row.id) ?? null,
  }));
}
