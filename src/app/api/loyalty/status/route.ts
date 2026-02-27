// GET /api/loyalty/status — Get user's loyalty status (platform-level)
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getUserLoyaltyStatus } from "@/lib/services/loyalty.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const status = await getUserLoyaltyStatus(userId);
    if (!status) return apiError("NOT_FOUND", "Utilisateur introuvable");

    return apiSuccess(status);
  } catch (error) {
    return handleApiError(error, "loyalty/status/GET");
  }
}
