// /api/boucher/promotions — Boucher promo management (source=SHOP) + proposals
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET — List boucher's promotions + pending proposals from webmaster
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const [promotions, proposals] = await Promise.all([
      // Boucher's own promos
      prisma.promotion.findMany({
        where: { shopId, source: "SHOP", proposalStatus: null },
        orderBy: { createdAt: "desc" },
      }),
      // Webmaster proposals awaiting response
      prisma.promotion.findMany({
        where: { shopId, proposalStatus: { in: ["PROPOSED", "ACCEPTED", "REJECTED"] } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return apiSuccess({ promotions, proposals });
  } catch (error) {
    return handleApiError(error, "boucher/promotions/GET");
  }
}

// POST — Create a new boucher promotion
const createSchema = z.object({
  type: z.enum(["PERCENT", "FIXED", "FREE_FEES"]),
  valueCents: z.number().int().min(0).optional(),
  valuePercent: z.number().min(0).max(100).optional(),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  target: z.enum(["ALL", "LOYAL", "INACTIVE", "SPECIFIC_PRODUCTS"]).default("ALL"),
  targetProductIds: z.array(z.string()).default([]),
  minOrderCents: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).default(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  code: z.string().max(30).optional(),
  // Flash offer fields
  isFlash: z.boolean().default(false),
  flashDurationHours: z.number().int().min(1).max(24).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId, userId } = authResult;

    const body = await req.json();
    const data = createSchema.parse(body);

    // Flash offer limit: 3 per week per shop
    if (data.isFlash) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const flashCount = await prisma.promotion.count({
        where: {
          shopId,
          source: "SHOP",
          isFlash: true,
          createdAt: { gte: oneWeekAgo },
        },
      });

      if (flashCount >= 3) {
        return apiError(
          "VALIDATION_ERROR",
          "Limite de 3 offres flash par semaine atteinte"
        );
      }
    }

    const promotion = await prisma.promotion.create({
      data: {
        source: "SHOP",
        shopId,
        createdById: userId,
        type: data.type,
        valueCents: data.valueCents,
        valuePercent: data.valuePercent,
        label: data.label,
        description: data.description,
        target: data.target,
        targetProductIds: data.targetProductIds,
        minOrderCents: data.minOrderCents,
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        code: data.code?.toUpperCase() || null,
        isFlash: data.isFlash,
        flashDurationHours: data.flashDurationHours,
        isActive: true,
      },
    });

    // Send flash offer notification to users who ordered from this shop
    if (data.isFlash) {
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } });
      const recentCustomers = await prisma.order.findMany({
        where: { shopId, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        select: { userId: true },
        distinct: ["userId"],
      });
      Promise.all(
        recentCustomers.slice(0, 50).map((c) =>
          sendNotification("FLASH_OFFER", {
            userId: c.userId,
            shopId,
            shopName: shop?.name || "",
            promoLabel: data.label,
            promoCode: data.code?.toUpperCase() || undefined,
          }).catch(() => {})
        )
      ).catch(() => {});
    }

    return apiSuccess(promotion);
  } catch (error) {
    return handleApiError(error, "boucher/promotions/POST");
  }
}
