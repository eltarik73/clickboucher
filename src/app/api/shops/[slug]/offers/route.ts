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
      select: { id: true },
    });

    if (!shop) return apiError("NOT_FOUND", "Boucherie introuvable");

    const offers = await prisma.offer.findMany({
      where: {
        shopId: shop.id,
        expiresAt: { gt: new Date() },
        remainingQty: { gt: 0 },
      },
      orderBy: [{ isSponsored: "desc" }, { expiresAt: "asc" }],
    });

    return apiSuccess(offers);
  } catch (error) {
    return handleApiError(error);
  }
}
