import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { offersQuerySchema } from "@/lib/validators";
import { apiPaginated, handleApiError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = offersQuerySchema.parse(params);

    const where: Record<string, unknown> = {
      expiresAt: { gt: new Date() },
      remainingQty: { gt: 0 },
    };
    if (query.shopId) where.shopId = query.shopId;

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true, slug: true, imageUrl: true } },
        },
        orderBy: query.sponsoredFirst
          ? [{ isSponsored: "desc" }, { expiresAt: "asc" }]
          : [{ expiresAt: "asc" }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.offer.count({ where }),
    ]);

    return apiPaginated(offers, total, query.page, query.perPage);
  } catch (error) {
    return handleApiError(error);
  }
}
