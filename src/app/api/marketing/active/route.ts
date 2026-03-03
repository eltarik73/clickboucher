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
        diffBadge: true,
        diffBanner: true,
        diffPopup: true,
        bannerTitle: true,
        bannerSubtitle: true,
        bannerColor: true,
        bannerPosition: true,
        bannerImageUrl: true,
        popupTitle: true,
        popupMessage: true,
        popupColor: true,
        popupFrequency: true,
        popupImageUrl: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Promo codes with diffBanner or diffPopup active — merge with campaigns
    const codeBanners = promoCodes
      .filter((c) => c.diffBanner)
      .map((c) => ({
        id: `code-${c.id}`,
        type: "BANNER" as const,
        name: c.bannerTitle || c.label,
        imageUrl: c.bannerImageUrl,
        linkUrl: null,
        bannerText: c.bannerSubtitle || c.label,
        bannerColor: c.bannerColor,
        bannerPosition: c.bannerPosition,
        code: c.code,
      }));

    const codePopups = promoCodes
      .filter((c) => c.diffPopup)
      .map((c) => ({
        id: `code-${c.id}`,
        type: "POPUP" as const,
        name: c.popupTitle || c.label,
        imageUrl: c.popupImageUrl,
        linkUrl: null,
        popupTitle: c.popupTitle || c.label,
        popupMessage: c.popupMessage,
        popupColor: c.popupColor,
        popupFrequency: c.popupFrequency,
        code: c.code,
      }));

    const banners = [
      ...campaigns.filter((c) => c.type === "BANNER"),
      ...codeBanners,
    ];
    const popups = [
      ...campaigns.filter((c) => c.type === "POPUP"),
      ...codePopups,
    ];

    return apiSuccess({ banners, popups, promoCodes });
  } catch (error) {
    return handleApiError(error, "marketing/active/GET");
  }
}
