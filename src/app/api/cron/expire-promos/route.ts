import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET /api/cron/expire-promos ──────────────
// Expire all promos where promoEnd < now()
// Called by node-cron on Railway, or manually via GET
export async function GET(req: NextRequest) {
  try {
    if (!process.env.CRON_SECRET) {
      return apiError("INTERNAL_ERROR", "CRON_SECRET not configured");
    }
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return apiError("UNAUTHORIZED", "Invalid cron secret");
    }

    const result = await prisma.product.updateMany({
      where: {
        promoEnd: { lt: new Date() },
        promoPct: { not: null },
      },
      data: {
        promoPct: null,
        promoType: null,
        promoEnd: null,
      },
    });

    return apiSuccess({
      expired: result.count,
      at: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
