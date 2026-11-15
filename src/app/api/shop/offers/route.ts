// src/app/api/shop/offers/route.ts — Boucher offers management
import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { createOfferSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

/**
 * What a butcher sets on its own offer. The payer is always the butcher, the shop always its own,
 * and the home-page popup and banner (free text, remote image, shown to every visitor) are
 * published by the platform only: their fields are refused, never ignored. ButcherOfferForm sends
 * payer "BUTCHER", diffBanner false and diffPopup false, so those exact values stay accepted.
 */
const butcherOfferSchema = createOfferSchema
  .omit({
    payer: true,
    shopId: true,
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
  })
  .extend({
    payer: z.literal("BUTCHER").optional(),
    diffBanner: z.literal(false).optional(),
    diffPopup: z.literal(false).optional(),
  })
  .strict();

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

    const parsed = butcherOfferSchema.parse(await readJsonBody(req));

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
        diffBanner: false,
        diffPopup: false,
      },
    });

    return apiSuccess(offer, 201);
  } catch (error) {
    return handleApiError(error, "shop/offers POST");
  }
}
