// src/lib/reviews/verified-rating.ts — the only place that computes a shop rating fit for
// publication (JSON-LD aggregateRating and review of /boutique/[slug]).
//
// A review is verified when its order is its own (same customer, same shop) and was collected
// (PICKED_UP or COMPLETED). Nothing else counts: Shop.rating and Shop.ratingCount are seeded or
// cached figures, the seed writes reviews without any order, and POST /api/reviews accepts a
// review without one. Review has no Prisma relation to Order, hence the SQL join. Table names are
// left unqualified so that the connection's schema applies (the integration suite runs in itest).
import { Prisma, type OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { MAX_PUBLISHED_REVIEWS } from "@/lib/seo/jsonld/shop";

export type VerifiedReview = {
  rating: number;
  comment: string;
  authorName: string;
  createdAt: Date;
};

export type VerifiedShopRating = {
  /** Mean of the verified ratings, unrounded. */
  average: number;
  /** Number of verified reviews, at least 1. */
  count: number;
  /** Newest verified reviews with a text, at most MAX_PUBLISHED_REVIEWS (two). */
  reviews: VerifiedReview[];
};

/** An order in one of these statuses was collected by its customer. */
const COLLECTED_ORDER_STATUSES = [
  "PICKED_UP",
  "COMPLETED",
] as const satisfies readonly OrderStatus[];

// The verified reviews: each review joined to its own collected order. The status is compared as
// text because the values are sent as text parameters.
const VERIFIED_REVIEWS = Prisma.sql`
  "reviews" r
  JOIN "orders" o
    ON o."id" = r."order_id"
   AND o."shop_id" = r."shop_id"
   AND o."user_id" = r."user_id"
   AND o."status"::text IN (${Prisma.join(COLLECTED_ORDER_STATUSES)})`;

type AggregateRow = { average: number | null; count: number };

type ReviewRow = {
  rating: number;
  comment: string;
  createdAt: Date;
  firstName: string;
  lastName: string;
};

/** « Amina K. » from first and last name; « Client » when the first name is blank. */
function authorName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  if (first === "") return "Client";
  const capitalized = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial === "" ? capitalized : `${capitalized} ${initial}.`;
}

/**
 * The verified rating of a shop, or null when it has no verified review. `reviews` holds the
 * newest verified reviews with a non-blank text, at most two.
 */
export async function loadVerifiedShopRating(shopId: string): Promise<VerifiedShopRating | null> {
  const [aggregate] = await prisma.$queryRaw<AggregateRow[]>`
    SELECT AVG(r."rating")::float8 AS "average", COUNT(*)::int AS "count"
    FROM ${VERIFIED_REVIEWS}
    WHERE r."shop_id" = ${shopId}`;
  if (aggregate.count === 0 || aggregate.average === null) return null;

  const rows = await prisma.$queryRaw<ReviewRow[]>`
    SELECT r."rating" AS "rating", r."comment" AS "comment", r."created_at" AS "createdAt",
           u."first_name" AS "firstName", u."last_name" AS "lastName"
    FROM ${VERIFIED_REVIEWS}
    JOIN "users" u ON u."id" = r."user_id"
    WHERE r."shop_id" = ${shopId}
      AND r."comment" ~ '[^[:space:]]'
    ORDER BY r."created_at" DESC, r."id" DESC
    LIMIT ${MAX_PUBLISHED_REVIEWS}`;

  return {
    average: aggregate.average,
    count: aggregate.count,
    reviews: rows
      .map((row) => ({
        rating: row.rating,
        comment: row.comment.trim(),
        authorName: authorName(row.firstName, row.lastName),
        createdAt: row.createdAt,
      }))
      // JavaScript trims more kinds of space than [:space:]: never publish an empty text.
      .filter((review) => review.comment !== ""),
  };
}
