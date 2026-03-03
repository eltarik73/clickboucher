// src/app/api/dashboard/offers/route.ts — List & create offers (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { createOfferSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

// ── GET — List offers (filterable by status, payer) ──────────
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const payer = searchParams.get("payer");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (payer) where.payer = payer;

    const offers = await prisma.offer.findMany({
      where,
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        eligibleProducts: true,
        _count: { select: { proposals: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess(offers);
  } catch (error) {
    return handleApiError(error, "dashboard/offers GET");
  }
}

// ── POST — Create offer ──────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = createOfferSchema.parse(body);

    // Check code uniqueness
    const existing = await prisma.offer.findUnique({
      where: { code: data.code },
      select: { id: true },
    });
    if (existing) {
      return apiError("CONFLICT", "Ce code promo existe déjà");
    }

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
        maxUses: data.maxUses ?? null,
        shopId: data.shopId ?? null,
        status: "ACTIVE",
        diffBadge: data.diffBadge,
        diffBanner: data.diffBanner,
        diffPopup: data.diffPopup,
        bannerTitle: data.bannerTitle ?? null,
        bannerSubtitle: data.bannerSubtitle ?? null,
        bannerColor: data.bannerColor ?? null,
        bannerPosition: data.bannerPosition ?? null,
        bannerImageUrl: data.bannerImageUrl ?? null,
        popupTitle: data.popupTitle ?? null,
        popupMessage: data.popupMessage ?? null,
        popupColor: data.popupColor ?? null,
        popupFrequency: data.popupFrequency ?? null,
        popupImageUrl: data.popupImageUrl ?? null,
      },
    });

    return apiSuccess(offer, 201);
  } catch (error) {
    return handleApiError(error, "dashboard/offers POST");
  }
}
