// GET /api/webmaster/config/price-adjustment — the safety cap of one price adjustment as the server
// applies it (getMaxIncreasePct: the stored cap, or the default when none or an invalid one is
// stored), for the webmaster's settings page. It is written by PATCH /api/webmaster/config.
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { getMaxIncreasePct } from "@/lib/price-adjustment";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    return apiSuccess({ maxIncreasePct: await getMaxIncreasePct() });
  } catch (error) {
    return handleApiError(error, "webmaster/config/price-adjustment");
  }
}
