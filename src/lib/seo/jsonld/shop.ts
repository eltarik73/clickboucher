// JSON-LD of a shop as a business, emitted only by its own page /boutique/[slug]: list pages
// (cities, departments, products, occasions, home) never describe a shop entity.
//
// Every field is data the shop entered: name, description, phone, address, coordinates, photo,
// opening hours. Nothing is asserted on its behalf (no price range, payment methods, cuisine,
// keywords or region). aggregateRating and review come only from verified reviews
// (src/lib/reviews/verified-rating.ts), never from Shop.rating / ratingCount.
// Pure: no I/O, no clock.

import { resolveShopPhoto } from "@/lib/images/product-photo";
import { MAX_PUBLISHED_REVIEWS, publishedRatingValue } from "@/lib/reviews/rating";
import type { VerifiedReview, VerifiedShopRating } from "@/lib/reviews/verified-rating";
import { getDayHours, type OpeningHours } from "@/lib/shop-hours";
import type { JsonLdObject } from "@/lib/seo/jsonld/pages";
import { shopPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";

export type ShopJsonLdInput = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  phone: string;
  address: string;
  city: string;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Shop.openingHours as stored (JSON keyed by French day names). */
  openingHours: unknown;
};

const BEST_RATING = 5;
const WORST_RATING = 1;

// schema.org day names by Date#getDay() index, listed Monday first.
const WEEK: readonly { jsDay: number; dayOfWeek: string }[] = [
  { jsDay: 1, dayOfWeek: "Monday" },
  { jsDay: 2, dayOfWeek: "Tuesday" },
  { jsDay: 3, dayOfWeek: "Wednesday" },
  { jsDay: 4, dayOfWeek: "Thursday" },
  { jsDay: 5, dayOfWeek: "Friday" },
  { jsDay: 6, dayOfWeek: "Saturday" },
  { jsDay: 0, dayOfWeek: "Sunday" },
];

/** A media URL as published: a site path becomes absolute, an https URL stays as it is. */
export function absoluteMediaUrl(url: string): string {
  return url.startsWith("/") ? absoluteUrl(url) : url;
}

function nonBlank(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** "H:MM" or "HH:MM" as "HH:MM", or null when the value is not a time of day. */
function timeOfDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/**
 * One OpeningHoursSpecification per open day, read through getDayHours (French keys, English
 * short keys accepted). A day without hours is closed. When one open day carries a time that is
 * not « HH:MM », no hours are published at all: a week with a guessed day would be false.
 */
function openingHoursSpecification(openingHours: unknown): JsonLdObject[] {
  if (openingHours === null || typeof openingHours !== "object" || Array.isArray(openingHours)) {
    return [];
  }
  const specification: JsonLdObject[] = [];
  for (const { jsDay, dayOfWeek } of WEEK) {
    const hours = getDayHours(openingHours as OpeningHours, jsDay);
    if (hours === null) continue;
    const opens = timeOfDay(hours.open);
    const closes = timeOfDay(hours.close);
    if (opens === null || closes === null) return [];
    specification.push({ "@type": "OpeningHoursSpecification", dayOfWeek, opens, closes });
  }
  return specification;
}

function reviewJsonLd(review: VerifiedReview): JsonLdObject {
  return {
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: BEST_RATING,
      worstRating: WORST_RATING,
    },
    author: { "@type": "Person", name: review.authorName },
    datePublished: review.createdAt.toISOString(),
    reviewBody: review.comment,
  };
}

function ratingJsonLd(rating: VerifiedShopRating): JsonLdObject {
  if (!Number.isInteger(rating.count) || rating.count < 1) {
    throw new RangeError(
      `A published rating needs at least one verified review, got ${rating.count}`
    );
  }
  const reviews = rating.reviews.slice(0, MAX_PUBLISHED_REVIEWS);
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: publishedRatingValue(rating.average),
      reviewCount: rating.count,
      bestRating: BEST_RATING,
      worstRating: WORST_RATING,
    },
    ...(reviews.length > 0 && { review: reviews.map(reviewJsonLd) }),
  };
}

/** Store entity of the shop page. `rating` is the shop's verified rating, null when it has none. */
export function buildShopJsonLd(
  shop: ShopJsonLdInput,
  rating: VerifiedShopRating | null
): JsonLdObject {
  const url = absoluteUrl(shopPath(shop.slug));
  const description = nonBlank(shop.description);
  const telephone = nonBlank(shop.phone);
  const streetAddress = nonBlank(shop.address);
  const addressLocality = nonBlank(shop.city);
  const photo = resolveShopPhoto({ id: shop.id, imageUrl: shop.imageUrl }).own;
  const hours = openingHoursSpecification(shop.openingHours);

  return {
    "@context": "https://schema.org",
    "@type": ["Store", "FoodEstablishment", "LocalBusiness"],
    "@id": url,
    name: shop.name,
    url,
    ...(description !== null && { description }),
    ...(telephone !== null && { telephone }),
    ...(photo !== null && { image: absoluteMediaUrl(photo) }),
    address: {
      "@type": "PostalAddress",
      ...(streetAddress !== null && { streetAddress }),
      ...(addressLocality !== null && { addressLocality }),
      addressCountry: "FR",
    },
    ...(shop.latitude !== null &&
      shop.longitude !== null && {
        geo: { "@type": "GeoCoordinates", latitude: shop.latitude, longitude: shop.longitude },
      }),
    ...(hours.length > 0 && { openingHoursSpecification: hours }),
    ...(rating !== null && ratingJsonLd(rating)),
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: url,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp",
    },
  };
}
