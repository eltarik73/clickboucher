// src/app/api/loyalty/config/route.ts — Boucher loyalty config
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const updateConfigSchema = z.object({
  active: z.boolean().optional(),
  ordersRequired: z.number().int().min(1).max(100).optional(),
  rewardPct: z.number().int().min(1).max(50).optional(),
});

export const dynamic = "force-dynamic";

// GET — Fetch loyalty config for current shop
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const rule = await prisma.loyaltyRule.findFirst({
      where: { shopId },
    });

    return apiSuccess({
      active: rule?.active ?? false,
      ordersRequired: rule?.ordersRequired ?? 10,
      rewardPct: rule?.rewardPct ?? 10,
    });
  } catch (error) {
    return handleApiError(error, "loyalty/config GET");
  }
}

// PATCH — Update loyalty config
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const rl = await checkRateLimit(rateLimits.api, `loyalty-config:${shopId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const body = await req.json();
    const { active, ordersRequired, rewardPct } = updateConfigSchema.parse(body);

    const rule = await prisma.loyaltyRule.upsert({
      where: { shopId },
      create: {
        shopId,
        active: active ?? true,
        ordersRequired: ordersRequired ?? 10,
        rewardPct: rewardPct ?? 10,
      },
      update: {
        ...(active !== undefined && { active }),
        ...(ordersRequired !== undefined && { ordersRequired }),
        ...(rewardPct !== undefined && { rewardPct }),
      },
    });

    return apiSuccess({
      active: rule.active,
      ordersRequired: rule.ordersRequired,
      rewardPct: rule.rewardPct,
    });
  } catch (error) {
    return handleApiError(error, "loyalty/config PATCH");
  }
}
