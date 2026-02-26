// API: GET/POST /api/webmaster/performance/[shopId]
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { refreshShopMetrics } from "@/lib/services/performance";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const { shopId } = params;
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        status: true,
        cachedAcceptanceRate: true,
        cachedAvgPrepMinutes: true,
        cachedCancelRate: true,
        cachedResponseMinutes: true,
        cachedLateRate: true,
        cachedAvgRating: true,
        performanceScore: true,
        metricsUpdatedAt: true,
      },
    });

    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const alerts = await prisma.shopAlert.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return apiSuccess({ shop, alerts });
  } catch (error) {
    return handleApiError(error, "GET /api/webmaster/performance/[shopId]");
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const { shopId } = params;
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const result = await refreshShopMetrics(shopId);

    return apiSuccess({ recalculated: true, ...result });
  } catch (error) {
    return handleApiError(error, "POST /api/webmaster/performance/[shopId]");
  }
}
