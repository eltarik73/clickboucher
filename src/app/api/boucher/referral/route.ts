// GET /api/boucher/referral — Get referral code and referrals for current boucher
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true, shopReferralCode: true, slug: true, name: true },
    });

    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    // Generate referral code if not exists
    let code = shop.shopReferralCode;
    if (!code) {
      const year = new Date().getFullYear();
      code = `${shop.slug.toUpperCase().replace(/-/g, "").slice(0, 8)}-${year}`;

      // Ensure uniqueness
      const exists = await prisma.shop.findUnique({ where: { shopReferralCode: code } });
      if (exists) code = `${code}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

      await prisma.shop.update({
        where: { id: shop.id },
        data: { shopReferralCode: code },
      });
    }

    // Get referrals made by this shop
    const referrals = await prisma.referral.findMany({
      where: { referrerShopId: shop.id },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with shop names
    const referredShopIds = referrals.map((r) => r.referredShopId);
    const referredShops = await prisma.shop.findMany({
      where: { id: { in: referredShopIds } },
      select: { id: true, name: true },
    });
    const shopMap = new Map(referredShops.map((s) => [s.id, s]));

    const enrichedReferrals = referrals.map((r) => ({
      shopName: shopMap.get(r.referredShopId)?.name || "Boutique",
      status: r.referrerRewardApplied ? "rewarded" : "pending",
      createdAt: r.createdAt.toISOString(),
    }));

    return apiSuccess({
      code,
      referrals: enrichedReferrals,
      maxReached: referrals.length >= 10,
    });
  } catch (error) {
    return handleApiError(error, "boucher/referral");
  }
}
