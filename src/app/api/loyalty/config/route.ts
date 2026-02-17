// src/app/api/loyalty/config/route.ts — Boucher configures loyalty rule
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

const configSchema = z.object({
  ordersRequired: z.number().int().min(2).max(50),
  rewardPct: z.number().int().min(1).max(50),
  active: z.boolean(),
});

// ── GET /api/loyalty/config — Get loyalty config for boucher's shop ──
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: clerkId },
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const rule = await prisma.loyaltyRule.findFirst({
      where: { shopId: shop.id },
    });

    if (!rule) {
      return apiSuccess({ active: false, ordersRequired: 10, rewardPct: 10 });
    }

    return apiSuccess({
      active: rule.active,
      ordersRequired: rule.ordersRequired,
      rewardPct: rule.rewardPct,
    });
  } catch (error) {
    return handleApiError(error, "loyalty/config/GET");
  }
}

// ── PATCH /api/loyalty/config — Update loyalty rule ──
export async function PATCH(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: clerkId },
      select: { id: true, name: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const body = await req.json();
    const data = configSchema.parse(body);

    // Upsert the loyalty rule
    const existing = await prisma.loyaltyRule.findFirst({
      where: { shopId: shop.id },
    });

    let rule;
    if (existing) {
      rule = await prisma.loyaltyRule.update({
        where: { id: existing.id },
        data: {
          ordersRequired: data.ordersRequired,
          rewardPct: data.rewardPct,
          active: data.active,
        },
      });
    } else {
      rule = await prisma.loyaltyRule.create({
        data: {
          description: `Fidélité ${shop.name}`,
          ordersRequired: data.ordersRequired,
          rewardPct: data.rewardPct,
          active: data.active,
          shopId: shop.id,
        },
      });
    }

    return apiSuccess({
      active: rule.active,
      ordersRequired: rule.ordersRequired,
      rewardPct: rule.rewardPct,
    });
  } catch (error) {
    return handleApiError(error, "loyalty/config/PATCH");
  }
}
