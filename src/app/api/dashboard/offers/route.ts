// GET/POST /api/dashboard/offers — Webmaster offer management
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { createOfferSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const status = req.nextUrl.searchParams.get("status");
    const payer = req.nextUrl.searchParams.get("payer");

    const offers = await prisma.offer.findMany({
      where: {
        ...(status && status !== "all" ? { status: status as "ACTIVE" | "PAUSED" | "EXPIRED" | "DRAFT" } : {}),
        ...(payer && payer !== "all" ? { payer: payer as "KLIKGO" | "BUTCHER" } : {}),
      },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        _count: { select: { proposals: true, eligibleProducts: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess(offers);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const data = createOfferSchema.parse(body);

    // Check code uniqueness
    const existing = await prisma.offer.findUnique({ where: { code: data.code } });
    if (existing) return apiError("VALIDATION_ERROR", "Ce code existe déjà");

    const offer = await prisma.offer.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        discountValue: data.discountValue,
        minOrder: data.minOrder,
        payer: data.payer,
        audience: data.audience,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        maxUses: data.maxUses,
        shopId: data.shopId,
        status: "ACTIVE",
        diffBadge: data.diffBadge,
        diffBanner: data.diffBanner,
        diffPopup: data.diffPopup,
        bannerTitle: data.bannerTitle,
        bannerSubtitle: data.bannerSubtitle,
        bannerColor: data.bannerColor,
        bannerPosition: data.bannerPosition,
        bannerImageUrl: data.bannerImageUrl,
        popupTitle: data.popupTitle,
        popupMessage: data.popupMessage,
        popupColor: data.popupColor,
        popupFrequency: data.popupFrequency,
        popupImageUrl: data.popupImageUrl,
      },
    });

    return apiSuccess(offer);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/POST");
  }
}
