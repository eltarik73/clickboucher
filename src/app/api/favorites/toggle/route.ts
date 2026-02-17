import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const { shopId } = await req.json();
    if (!shopId) {
      return apiError("VALIDATION_ERROR", "shopId requis");
    }

    const baseUser = await getOrCreateUser(clerkId);
    if (!baseUser) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const user = await prisma.user.findUnique({
      where: { id: baseUser.id },
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
