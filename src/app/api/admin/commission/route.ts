// GET /api/admin/commission — Global commission overview
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    // All shops with commission info
    const shops = await prisma.shop.findMany({
      where: { visible: true },
      select: {
        id: true,
        name: true,
        commissionPct: true,
        commissionEnabled: true,
      },
      orderBy: { name: "asc" },
    });

    // Total commission earned
    const totalCommission = await prisma.order.aggregate({
      where: { status: { in: ["COMPLETED", "PICKED_UP"] } },
      _sum: { commissionCents: true },
    });

    // Commission this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyCommission = await prisma.order.aggregate({
      where: {
        status: { in: ["COMPLETED", "PICKED_UP"] },
        createdAt: { gte: monthStart },
      },
      _sum: { commissionCents: true },
    });

    return apiSuccess({
      shops,
      totalCommissionCents: totalCommission._sum.commissionCents || 0,
      monthlyCommissionCents: monthlyCommission._sum.commissionCents || 0,
    });
  } catch (error) {
    return handleApiError(error, "admin/commission");
  }
}
