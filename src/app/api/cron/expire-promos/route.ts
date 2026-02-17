import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET /api/cron/expire-promos ──────────────
// Expire all promos where promoEnd < now()
// Call via Vercel Cron, Railway cron, or manually
export async function GET() {
  try {
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

    console.log(`[expire-promos] Expired ${result.count} promos`);

    return apiSuccess({
      expired: result.count,
      at: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
