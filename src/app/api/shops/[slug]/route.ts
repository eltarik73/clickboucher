import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { slug: params.slug },
      include: {
        openingHours: { orderBy: { dayOfWeek: "asc" } },
        products: {
          where: { isInStock: true },
          orderBy: { sortOrder: "asc" },
        },
        packs: {
          where: { isInStock: true },
          include: { items: { include: { product: true } } },
          orderBy: { sortOrder: "asc" },
        },
        offers: {
          where: { expiresAt: { gt: new Date() }, remainingQty: { gt: 0 } },
          orderBy: [{ isSponsored: "desc" }, { expiresAt: "asc" }],
        },
        _count: { select: { orders: true, favorites: true } },
      },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    return apiSuccess(shop);
  } catch (error) {
    return handleApiError(error);
  }
}
