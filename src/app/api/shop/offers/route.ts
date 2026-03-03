// GET/POST /api/shop/offers — Boucher offer management
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    // Boucher's own offers + proposals from webmaster
    const [ownOffers, proposals] = await Promise.all([
      prisma.offer.findMany({
        where: { shopId: auth.shopId },
        include: { _count: { select: { eligibleProducts: true, orders: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.offerProposal.findMany({
        where: { shopId: auth.shopId },
        include: {
          offer: {
            select: { id: true, name: true, code: true, type: true, discountValue: true, payer: true, startDate: true, endDate: true, minOrder: true, audience: true, diffBadge: true, diffBanner: true, diffPopup: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return apiSuccess({ offers: ownOffers, proposals });
  } catch (error) {
    return handleApiError(error, "shop/offers/GET");
  }
}

const createSchema = z.object({
  name: z.string().min(3).max(100),
  code: z.string().min(3).max(30).transform((v) => v.toUpperCase().trim()),
  type: z.enum(["PERCENT", "AMOUNT", "FREE_DELIVERY", "BOGO", "BUNDLE"]),
  discountValue: z.number().positive(),
  minOrder: z.number().min(0).default(0),
  audience: z.enum(["ALL", "NEW", "LOYAL", "VIP"]).default("ALL"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxUses: z.number().int().min(1).optional(),
  diffBanner: z.boolean().default(false),
  bannerTitle: z.string().max(100).optional(),
  bannerSubtitle: z.string().max(200).optional(),
  bannerColor: z.enum(["red", "black", "green", "orange", "blue", "purple", "amber"]).default("red"),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = createSchema.parse(body);

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
        payer: "BUTCHER",
        audience: data.audience,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        maxUses: data.maxUses,
        shopId: auth.shopId,
        status: "ACTIVE",
        diffBadge: true,
        diffBanner: data.diffBanner,
        bannerTitle: data.bannerTitle,
        bannerSubtitle: data.bannerSubtitle,
        bannerColor: data.bannerColor,
      },
    });

    return apiSuccess(offer);
  } catch (error) {
    return handleApiError(error, "shop/offers/POST");
  }
}
