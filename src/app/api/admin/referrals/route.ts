// GET /api/admin/referrals — List all referrals
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const referrals = await prisma.referral.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Enrich with shop names
    const shopIds = [
      ...new Set([
        ...referrals.map((r) => r.referrerShopId),
        ...referrals.map((r) => r.referredShopId),
      ]),
    ];

    const shops = await prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true },
    });
    const shopMap = new Map(shops.map((s) => [s.id, s.name]));

    const data = referrals.map((r) => ({
      ...r,
      referrerShopName: shopMap.get(r.referrerShopId) || r.referrerShopId,
      referredShopName: shopMap.get(r.referredShopId) || r.referredShopId,
    }));

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error, "admin/referrals");
  }
}
