// GET /api/marketing/active — Active banners, popups, and promo codes for clients
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    // Active campaigns (BANNER & POPUP only)
    const campaigns = await prisma.marketingCampaign.findMany({
      where: {
        status: "ACTIVE",
        type: { in: ["BANNER", "POPUP"] },
        startsAt: { lte: now },
        OR: [
          { endsAt: null },
          { endsAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        type: true,
        name: true,
        imageUrl: true,
        linkUrl: true,
        bannerText: true,
        popupTitle: true,
        popupMessage: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Active platform promo codes (public ones for display)
    const promoCodes = await prisma.promoCode.findMany({
      where: {
        status: "ACTIVE",
        scope: "PLATFORM",
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: {
        id: true,
        code: true,
        discountType: true,
        valueCents: true,
        valuePercent: true,
        label: true,
        isFlash: true,
        endsAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const banners = campaigns.filter((c) => c.type === "BANNER");
    const popups = campaigns.filter((c) => c.type === "POPUP");

    return apiSuccess({ banners, popups, promoCodes });
  } catch (error) {
    return handleApiError(error, "marketing/active/GET");
  }
}
