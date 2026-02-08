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

    const products = await prisma.product.findMany({
      where: { shopId: shop.id },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });

    return apiSuccess(products);
  } catch (error) {
    return handleApiError(error);
  }
}
