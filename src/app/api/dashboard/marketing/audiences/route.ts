// src/app/api/dashboard/marketing/audiences/route.ts — Audience segment counts (admin)
import { requireAdmin } from "@/lib/admin-auth";
import { getAudienceCounts } from "@/lib/marketing/audience-counts";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET — Audience counts ─────────────────────────────────────
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const counts = await getAudienceCounts();

    return apiSuccess(counts);
  } catch (error) {
    return handleApiError(error, "dashboard/marketing/audiences GET");
  }
}
