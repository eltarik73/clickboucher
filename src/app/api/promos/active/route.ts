// GET /api/promos/active — Returns active platform + flash promos for clients
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    // Platform promos (source=PLATFORM, active, not expired)
    const platformPromos = await prisma.promotion.findMany({
      where: {
        source: "PLATFORM",
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: {
        id: true,
        type: true,
        valueCents: true,
        valuePercent: true,
        label: true,
        code: true,
        minOrderCents: true,
        target: true,
        endsAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Flash offers from shops (source=SHOP, isFlash=true, active)
    const flashOffers = await prisma.promotion.findMany({
      where: {
        source: "SHOP",
        isFlash: true,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: {
        id: true,
        type: true,
        valueCents: true,
        valuePercent: true,
        label: true,
        code: true,
        shopId: true,
        shop: { select: { name: true, slug: true, imageUrl: true } },
        endsAt: true,
        flashDurationHours: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return apiSuccess({ platformPromos, flashOffers });
  } catch (error) {
    return handleApiError(error, "promos/active/GET");
  }
}
