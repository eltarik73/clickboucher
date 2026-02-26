// GET /api/webmaster/reviews — All reviews with filters for webmaster
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const sp = req.nextUrl.searchParams;
    const { page, perPage } = parsePagination(sp, { page: 1, perPage: 30 });
    const shopId = sp.get("shopId") || "";
    const rating = sp.get("rating") || ""; // "1" | "2" | "3" | "4" | "5" | ""
    const sortBy = sp.get("sort") || "newest"; // "newest" | "oldest" | "rating_asc" | "rating_desc"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (shopId) where.shopId = shopId;
    if (rating) where.rating = Number(rating);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any;
    switch (sortBy) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "rating_asc":
        orderBy = { rating: "asc" };
        break;
      case "rating_desc":
        orderBy = { rating: "desc" };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          shop: { select: { id: true, name: true } },
        },
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.review.count({ where }),
    ]);

    // Stats
    const [totalReviews, avgRating, ratingDist] = await Promise.all([
      prisma.review.count(),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.review.groupBy({
        by: ["rating"],
        _count: true,
        orderBy: { rating: "desc" },
      }),
    ]);

    return apiSuccess({
      reviews,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      stats: {
        totalReviews,
        avgRating: avgRating._avg.rating || 0,
        distribution: ratingDist.map((r) => ({
          rating: r.rating,
          count: r._count,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error, "webmaster/reviews");
  }
}
