import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const baseUser = await getOrCreateUser(clerkId);
    if (!baseUser) {
      return apiSuccess([]);
    }

    const user = await prisma.user.findUnique({
      where: { id: baseUser.id },
      select: {
        favoriteShops: {
          select: {
            id: true,
            slug: true,
            name: true,
            address: true,
            city: true,
            imageUrl: true,
            prepTimeMin: true,
            busyMode: true,
            busyExtraMin: true,
            isOpen: true,
            rating: true,
            ratingCount: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    return apiSuccess(user?.favoriteShops ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}
