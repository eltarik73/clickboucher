// API: GET /api/webmaster/performance — All shops performance overview
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const shops = await prisma.shop.findMany({
      where: { visible: true },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        imageUrl: true,
        status: true,
        rating: true,
        ratingCount: true,
        cachedAcceptanceRate: true,
        cachedAvgPrepMinutes: true,
        cachedCancelRate: true,
        cachedResponseMinutes: true,
        cachedLateRate: true,
        cachedAvgRating: true,
        performanceScore: true,
        metricsUpdatedAt: true,
        _count: { select: { alerts: { where: { resolved: false } } } },
      },
      orderBy: [{ performanceScore: "asc" }],
    });

    return apiSuccess(shops);
  } catch (error) {
    return handleApiError(error, "GET /api/webmaster/performance");
  }
}
