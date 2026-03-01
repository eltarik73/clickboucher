// GET /api/admin/shops/[shopId]/adjustments — Price adjustments for a shop
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = params;

    // Fetch last 50 adjustments for this shop
    const adjustments = await prisma.priceAdjustment.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        order: {
          select: { orderNumber: true },
        },
      },
    });

    // Compute stats
    const total = adjustments.length;
    const accepted = adjustments.filter((a) =>
      ["AUTO_APPROVED", "APPROVED", "AUTO_VALIDATED"].includes(a.status)
    ).length;
    const rejected = adjustments.filter((a) => a.status === "REJECTED").length;
    const escalated = adjustments.filter((a) => a.status === "ESCALATED").length;
    const pending = adjustments.filter((a) => a.status === "PENDING").length;

    // Average variance % (absolute)
    const variances = adjustments
      .filter((a) => a.originalTotal > 0)
      .map((a) => Math.abs(((a.newTotal - a.originalTotal) / a.originalTotal) * 100));
    const avgVariancePct = variances.length > 0
      ? Math.round((variances.reduce((s, v) => s + v, 0) / variances.length) * 10) / 10
      : 0;

    // Acceptance rate (excluding pending)
    const resolved = total - pending;
    const acceptanceRate = resolved > 0
      ? Math.round((accepted / resolved) * 1000) / 10
      : 0;

    // Total orders for this shop (to compute adjustment rate)
    const totalOrders = await prisma.order.count({ where: { shopId } });
    const adjustmentRate = totalOrders > 0
      ? Math.round((total / totalOrders) * 1000) / 10
      : 0;

    return apiSuccess({
      adjustments: adjustments.map((a) => ({
        id: a.id,
        orderNumber: a.order.orderNumber,
        adjustmentType: a.adjustmentType,
        originalTotal: a.originalTotal,
        newTotal: a.newTotal,
        tier: a.tier,
        status: a.status,
        reason: a.reason,
        createdAt: a.createdAt,
        respondedAt: a.respondedAt,
      })),
      stats: {
        total,
        accepted,
        rejected,
        escalated,
        pending,
        avgVariancePct,
        acceptanceRate,
        totalOrders,
        adjustmentRate,
      },
    });
  } catch (error) {
    return handleApiError(error, "admin/shops/adjustments");
  }
}
