// /api/webmaster/loyalty — Manage platform loyalty program
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET — Current loyalty program config + stats
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    // Get or create default program
    let program = await prisma.loyaltyProgram.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!program) {
      program = await prisma.loyaltyProgram.create({
        data: {
          tiers: [
            { minOrders: 3, rewardType: "FIXED", rewardCents: 200, label: "3 commandes → -2€" },
            { minOrders: 7, rewardType: "FIXED", rewardCents: 500, label: "7 commandes → -5€" },
            { minOrders: 15, rewardType: "FIXED", rewardCents: 1000, label: "15 commandes → -10€" },
          ],
          isActive: true,
        },
      });
    }

    // Stats
    const [totalRewards, usedRewards, activeRewards, fideleCount] = await Promise.all([
      prisma.loyaltyReward.count(),
      prisma.loyaltyReward.count({ where: { usedAt: { not: null } } }),
      prisma.loyaltyReward.count({
        where: { usedAt: null, expiresAt: { gt: new Date() } },
      }),
      prisma.user.count({ where: { loyaltyBadge: "FIDELE" } }),
    ]);

    // Total discount given via loyalty
    const usedRewardsList = await prisma.loyaltyReward.findMany({
      where: { usedAt: { not: null } },
      select: { rewardCents: true },
    });
    const totalDiscountCents = usedRewardsList.reduce(
      (sum, r) => sum + (r.rewardCents || 0),
      0
    );

    return apiSuccess({
      program,
      stats: {
        totalRewards,
        usedRewards,
        activeRewards,
        fideleCount,
        totalDiscountCents,
        conversionRate: totalRewards > 0 ? Math.round((usedRewards / totalRewards) * 100) : 0,
      },
    });
  } catch (error) {
    return handleApiError(error, "webmaster/loyalty/GET");
  }
}

// PATCH — Update loyalty program
const updateSchema = z.object({
  isActive: z.boolean().optional(),
  tiers: z
    .array(
      z.object({
        minOrders: z.number().int().min(1),
        rewardType: z.enum(["FIXED", "PERCENT"]),
        rewardCents: z.number().int().min(0).optional(),
        rewardPercent: z.number().min(0).max(100).optional(),
        label: z.string().min(1),
      })
    )
    .optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Get existing program
    let program = await prisma.loyaltyProgram.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (program) {
      program = await prisma.loyaltyProgram.update({
        where: { id: program.id },
        data: {
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.tiers && { tiers: data.tiers }),
        },
      });
    } else {
      program = await prisma.loyaltyProgram.create({
        data: {
          tiers: data.tiers || [],
          isActive: data.isActive ?? true,
        },
      });
    }

    return apiSuccess(program);
  } catch (error) {
    return handleApiError(error, "webmaster/loyalty/PATCH");
  }
}
