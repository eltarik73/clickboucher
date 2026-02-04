import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return apiError("VALIDATION_ERROR", "userId requis");

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        shop: {
          include: {
            openingHours: true,
            _count: { select: { products: true, offers: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(favorites.map((f) => f.shop));
  } catch (error) {
    return handleApiError(error);
  }
}
