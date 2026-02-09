import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
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
