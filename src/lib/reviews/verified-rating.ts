// src/lib/reviews/verified-rating.ts — the only place that reads a shop rating fit for publication:
// the JSON-LD of /boutique/[slug] (aggregateRating, review), the figure of its header and review
// list, and the figure of every shop card of the list pages.
//
// A review is verified when its order is its own (same customer, same shop) and was collected
// (PICKED_UP or COMPLETED). Nothing else counts: Shop.rating and Shop.ratingCount are seeded or
// cached figures, the seed writes reviews without any order, and POST /api/reviews accepts a
// review without one. Review has no Prisma relation to Order, hence the SQL join. Table names are
// left unqualified so that the connection's schema applies (the integration suite runs in itest).
import { Prisma } from "@prisma/client";
import { COLLECTED_ORDER_STATUSES } from "@/lib/order-state-machine";
import prisma from "@/lib/prisma";
import { MAX_PUBLISHED_REVIEWS, type RatingSummary } from "@/lib/reviews/rating";

export type VerifiedReview = {
  rating: number;
  comment: string;
  authorName: string;
  createdAt: Date;
};

export type VerifiedShopRating = RatingSummary & {
  /** Newest verified reviews with a text, at most MAX_PUBLISHED_REVIEWS (two). */
  reviews: VerifiedReview[];
};

/** A verified review as the shop page lists it (serializable for a client component). */
export type VerifiedReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  /** ISO date. */
  createdAt: string;
  user: { firstName: string; lastInitial: string };
};

/** Most verified reviews the shop page lists. */
export const MAX_LISTED_REVIEWS = 50;

// The verified reviews: each review joined to its own collected order. The status is compared as
// text because the values are sent as text parameters.
const VERIFIED_REVIEWS = Prisma.sql`
  "reviews" r
  JOIN "orders" o
    ON o."id" = r."order_id"
   AND o."shop_id" = r."shop_id"
   AND o."user_id" = r."user_id"
   AND o."status"::text IN (${Prisma.join(COLLECTED_ORDER_STATUSES)})`;

type SummaryRow = { shopId: string; average: number; count: number };

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  firstName: string;
  lastName: string;
};

/** « Amina » and « K. » from first and last name; « Client » when the first name is blank. */
function authorParts(firstName: string, lastName: string): { first: string; initial: string } {
  const first = firstName.trim();
  const initial = lastName.trim().charAt(0).toUpperCase();
  return {
    first: first === "" ? "Client" : first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
    initial: first === "" || initial === "" ? "" : `${initial}.`,
  };
}

/**
 * The verified rating of each of these shops, in one grouped query. A shop without any verified
 * review is absent from the map. No query for an empty list.
 */
export async function loadVerifiedRatings(
  shopIds: readonly string[]
): Promise<Map<string, RatingSummary>> {
  const ids = [...new Set(shopIds)];
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT r."shop_id" AS "shopId", AVG(r."rating")::float8 AS "average", COUNT(*)::int AS "count"
    FROM ${VERIFIED_REVIEWS}
    WHERE r."shop_id" IN (${Prisma.join(ids)})
    GROUP BY r."shop_id"`;
  return new Map(rows.map((row) => [row.shopId, { average: row.average, count: row.count }]));
}

async function verifiedReviewRows(
  shopId: string,
  limit: number,
  withTextOnly: boolean
): Promise<ReviewRow[]> {
  const textFilter = withTextOnly ? Prisma.sql`AND r."comment" ~ '[^[:space:]]'` : Prisma.empty;
  return prisma.$queryRaw<ReviewRow[]>`
    SELECT r."id" AS "id", r."rating" AS "rating", r."comment" AS "comment",
           r."created_at" AS "createdAt", u."first_name" AS "firstName", u."last_name" AS "lastName"
    FROM ${VERIFIED_REVIEWS}
    JOIN "users" u ON u."id" = r."user_id"
    WHERE r."shop_id" = ${shopId} ${textFilter}
    ORDER BY r."created_at" DESC, r."id" DESC
    LIMIT ${limit}`;
}

/**
 * The verified rating of a shop, or null when it has no verified review. `reviews` holds the
 * newest verified reviews with a non-blank text, at most two.
 */
export async function loadVerifiedShopRating(shopId: string): Promise<VerifiedShopRating | null> {
  const summary = (await loadVerifiedRatings([shopId])).get(shopId);
  if (summary === undefined) return null;

  const rows = await verifiedReviewRows(shopId, MAX_PUBLISHED_REVIEWS, true);
  return {
    ...summary,
    reviews: rows
      .map((row) => {
        const author = authorParts(row.firstName, row.lastName);
        return {
          rating: row.rating,
          comment: (row.comment ?? "").trim(),
          authorName: author.initial === "" ? author.first : `${author.first} ${author.initial}`,
          createdAt: row.createdAt,
        };
      })
      // JavaScript trims more kinds of space than [:space:]: never publish an empty text.
      .filter((review) => review.comment !== ""),
  };
}

/** The newest verified reviews of a shop, with or without a text, for its review list. */
export async function listVerifiedReviews(shopId: string): Promise<VerifiedReviewItem[]> {
  const rows = await verifiedReviewRows(shopId, MAX_LISTED_REVIEWS, false);
  return rows.map((row) => {
    const author = authorParts(row.firstName, row.lastName);
    const comment = row.comment?.trim() ?? "";
    return {
      id: row.id,
      rating: row.rating,
      comment: comment === "" ? null : comment,
      createdAt: row.createdAt.toISOString(),
      user: { firstName: author.first, lastInitial: author.initial },
    };
  });
}
