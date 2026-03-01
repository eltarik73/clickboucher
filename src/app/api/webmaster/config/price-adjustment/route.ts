// GET /api/webmaster/config/price-adjustment — Parsed price adjustment config
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { getPriceAdjConfig } from "@/lib/price-adjustment";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const config = await getPriceAdjConfig();
    return apiSuccess(config);
  } catch (error) {
    return handleApiError(error, "webmaster/config/price-adjustment");
  }
}
