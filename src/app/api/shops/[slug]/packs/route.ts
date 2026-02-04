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

    const packs = await prisma.pack.findMany({
      where: { shopId: shop.id },
      include: { items: { include: { product: true } } },
      orderBy: { sortOrder: "asc" },
    });

    return apiSuccess(packs);
  } catch (error) {
    return handleApiError(error);
  }
}
