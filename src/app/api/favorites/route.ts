import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerUserId } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clerkId = await getServerUserId();
    // Anonymous users have no favorites — return empty array (was 401 before, which
    // caused console errors on the homepage for non-logged-in visitors).
    if (!clerkId) {
      return apiSuccess([]);
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
            status: true,
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
