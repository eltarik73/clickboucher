// GET /api/loyalty/status — Get user's loyalty status (platform-level)
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getUserLoyaltyStatus } from "@/lib/services/loyalty.service";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Resolve Prisma user.id from clerkId
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!dbUser) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const status = await getUserLoyaltyStatus(dbUser.id);
    if (!status) return apiError("NOT_FOUND", "Statut de fidélité introuvable");

    return apiSuccess(status);
  } catch (error) {
    return handleApiError(error, "loyalty/status/GET");
  }
}
