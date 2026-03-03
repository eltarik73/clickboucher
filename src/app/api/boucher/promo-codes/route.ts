// GET/POST /api/boucher/promo-codes — Boucher promo code management
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET — List boucher's promo codes ──
export async function GET() {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const codes = await prisma.promoCode.findMany({
      where: { shopId: auth.shopId, scope: "SHOP" },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { usages: true, eligibleProducts: true } },
      },
    });

    return apiSuccess(codes);
  } catch (error) {
    return handleApiError(error, "boucher/promo-codes/GET");
  }
}

const createSchema = z.object({
  code: z.string().min(3).max(30).transform((v) => v.toUpperCase().trim()),
  discountType: z.enum(["PERCENT", "FIXED", "FREE_FEES", "BOGO", "BUNDLE"]),
  valueCents: z.number().int().min(0).optional(),
  valuePercent: z.number().min(0).max(100).optional(),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  audience: z.enum(["ALL", "NEW_CLIENTS", "LOYAL_CLIENTS", "INACTIVE_CLIENTS", "PRO_CLIENTS"]).default("ALL"),
  minOrderCents: z.number().int().min(0).optional(),
  maxDiscountCents: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).default(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isFlash: z.boolean().default(false),
});

// ── POST — Create a new promo code ──
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = createSchema.parse(body);

    // Check code uniqueness
    const existing = await prisma.promoCode.findUnique({ where: { code: data.code } });
    if (existing) {
      return apiError("VALIDATION_ERROR", "Ce code promo existe déjà");
    }

    // Flash promo rate limit: max 3 per week
    if (data.isFlash) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const flashCount = await prisma.promoCode.count({
        where: {
          shopId: auth.shopId,
          isFlash: true,
          createdAt: { gte: weekAgo },
        },
      });
      if (flashCount >= 3) {
        return apiError("VALIDATION_ERROR", "Maximum 3 offres flash par semaine");
      }
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: data.code,
        discountType: data.discountType,
        valueCents: data.valueCents,
        valuePercent: data.valuePercent,
        scope: "SHOP",
        shopId: auth.shopId,
        label: data.label,
        description: data.description,
        audience: data.audience,
        minOrderCents: data.minOrderCents,
        maxDiscountCents: data.maxDiscountCents,
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser,
        status: "ACTIVE",
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        isFlash: data.isFlash,
        createdById: auth.userId,
      },
    });

    return apiSuccess(promoCode);
  } catch (error) {
    return handleApiError(error, "boucher/promo-codes/POST");
  }
}
