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
        products: {
          where: { inStock: true },
          include: { category: true },
          orderBy: { name: "asc" },
        },
        categories: {
          orderBy: { order: "asc" },
        },
        _count: { select: { orders: true } },
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
