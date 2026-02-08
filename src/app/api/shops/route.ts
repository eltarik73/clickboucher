import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { shopListQuerySchema } from "@/lib/validators";
import { apiPaginated, handleApiError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = shopListQuerySchema.parse(params);

    const where: Record<string, unknown> = {};
    if (query.city) where.city = { contains: query.city, mode: "insensitive" };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        include: {
          _count: { select: { products: true } },
        },
        orderBy: [{ rating: "desc" }, { ratingCount: "desc" }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.shop.count({ where }),
    ]);

    return apiPaginated(shops, total, query.page, query.perPage);
  } catch (error) {
    return handleApiError(error);
  }
}
