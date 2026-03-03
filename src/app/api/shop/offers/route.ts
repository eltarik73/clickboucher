// src/app/api/shop/offers/route.ts — Boucher offers management
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { createOfferSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

/**
 * GET /api/shop/offers
 * Returns proposals (pending webmaster offers) + boucher's own offers
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const [proposals, offers] = await Promise.all([
      // Pending proposals from webmaster
      prisma.offerProposal.findMany({
        where: { shopId: auth.shopId, status: "PENDING" },
        include: {
          offer: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              discountValue: true,
              payer: true,
              audience: true,
              startDate: true,
              endDate: true,
              minOrder: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Boucher's own offers
      prisma.offer.findMany({
        where: { shopId: auth.shopId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          _count: { select: { orders: true } },
        },
      }),
    ]);

    return apiSuccess({ proposals, offers });
  } catch (error) {
    return handleApiError(error, "shop/offers GET");
  }
}

/**
 * POST /api/shop/offers
 * Create a new offer for the boucher's shop (payer forced to BUTCHER)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const body = await req.json();
    const parsed = createOfferSchema.parse(body);

    // Check code uniqueness
    const existing = await prisma.offer.findUnique({
      where: { code: parsed.code },
    });
    if (existing) {
      return apiError("CONFLICT", "Ce code promo existe déjà");
    }

    const offer = await prisma.offer.create({
      data: {
        shopId: auth.shopId,
        name: parsed.name,
        code: parsed.code,
        type: parsed.type,
        discountValue: parsed.discountValue,
        minOrder: parsed.minOrder,
        payer: "BUTCHER",
        audience: parsed.audience,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        maxUses: parsed.maxUses ?? null,
        status: "ACTIVE",
        diffBadge: parsed.diffBadge,
        diffBanner: parsed.diffBanner,
        diffPopup: parsed.diffPopup,
        bannerTitle: parsed.bannerTitle ?? null,
        bannerSubtitle: parsed.bannerSubtitle ?? null,
        bannerColor: parsed.bannerColor ?? null,
        bannerPosition: parsed.bannerPosition ?? null,
        bannerImageUrl: parsed.bannerImageUrl ?? null,
        popupTitle: parsed.popupTitle ?? null,
        popupMessage: parsed.popupMessage ?? null,
        popupColor: parsed.popupColor ?? null,
        popupFrequency: parsed.popupFrequency ?? null,
        popupImageUrl: parsed.popupImageUrl ?? null,
      },
    });

    return apiSuccess(offer, 201);
  } catch (error) {
    return handleApiError(error, "shop/offers POST");
  }
}
