import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const { id: shopId } = await params;

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        favoriteShops: { where: { id: shopId }, select: { id: true } },
      },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const alreadyFavorite = user.favoriteShops.length > 0;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        favoriteShops: alreadyFavorite
          ? { disconnect: { id: shopId } }
          : { connect: { id: shopId } },
      },
    });

    return apiSuccess({ isFavorite: !alreadyFavorite });
  } catch (error) {
    return handleApiError(error);
  }
}
