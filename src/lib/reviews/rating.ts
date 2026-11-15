// src/lib/reviews/rating.ts — how a verified shop rating is published, in the JSON-LD and on screen
// alike: one rounding, so that the figure a visitor reads and the ratingValue a search engine reads
// are the same number. The figures come from src/lib/reviews/verified-rating.ts only, never from
// Shop.rating / Shop.ratingCount (seeded or cached). Pure: no I/O, safe in client components.

/** A shop's verified rating: mean of its verified reviews and their number (at least 1). */
export type RatingSummary = { average: number; count: number };

/** The published rating value: the mean rounded to one decimal. */
export function publishedRatingValue(average: number): number {
  return Math.round(average * 10) / 10;
}

/** The rating as displayed: « 3.5 », « 4.0 ». */
export function formatRatingValue(average: number): string {
  return publishedRatingValue(average).toFixed(1);
}
