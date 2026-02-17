// GET  /api/boucher/stats/auto-promos — Get auto off-peak promo config
// PATCH /api/boucher/stats/auto-promos — Toggle auto off-peak promos (PREMIUM only)
import { NextRequest } from "next/server";
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
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const sub = await prisma.subscription.findUnique({
      where: { shopId: shop.id },
    });

    if (sub?.plan !== "PREMIUM") {
      return apiError("FORBIDDEN", "Fonctionnalite reservee au plan PREMIUM");
    }

    // Check if auto-promos is enabled via shop metadata
    // We use a PlanFeature record to store this setting
    const feature = await prisma.planFeature.findUnique({
      where: { plan_featureKey: { plan: "PREMIUM", featureKey: `auto_promos_${shop.id}` } },
    });

    return apiSuccess({
      enabled: feature?.enabled ?? false,
      discountPercent: 10,
    });
  } catch (error) {
    return handleApiError(error, "boucher/stats/auto-promos/GET");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const sub = await prisma.subscription.findUnique({
      where: { shopId: shop.id },
    });

    if (sub?.plan !== "PREMIUM") {
      return apiError("FORBIDDEN", "Fonctionnalite reservee au plan PREMIUM");
    }

    const { enabled } = await req.json();

    await prisma.planFeature.upsert({
      where: { plan_featureKey: { plan: "PREMIUM", featureKey: `auto_promos_${shop.id}` } },
      create: {
        plan: "PREMIUM",
        featureKey: `auto_promos_${shop.id}`,
        featureName: "Promos heures creuses",
        enabled: !!enabled,
      },
      update: { enabled: !!enabled },
    });

    return apiSuccess({
      enabled: !!enabled,
      discountPercent: 10,
    });
  } catch (error) {
    return handleApiError(error, "boucher/stats/auto-promos/PATCH");
  }
}
