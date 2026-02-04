import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { toggleFavoriteSchema } from "@/lib/validators";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, shopId } = toggleFavoriteSchema.parse(body);

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: { userId_shopId: { userId, shopId } },
    });

    if (existing) {
      // Remove
      await prisma.favorite.delete({ where: { id: existing.id } });
      return apiSuccess({ favorited: false, message: "Favori retiré" });
    } else {
      // Add
      await prisma.favorite.create({ data: { userId, shopId } });
      return apiSuccess({ favorited: true, message: "Ajouté aux favoris" });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
