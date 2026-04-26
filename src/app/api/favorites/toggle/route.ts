import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerUserId } from "@/lib/auth/server-auth";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const toggleFavoriteSchema = z.object({
  shopId: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const rl = await checkRateLimit(rateLimits.api, `fav-toggle:${clerkId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    let shopId: string;
    try {
      const body = await req.json();
      const parsed = toggleFavoriteSchema.parse(body);
      shopId = parsed.shopId;
    } catch {
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
