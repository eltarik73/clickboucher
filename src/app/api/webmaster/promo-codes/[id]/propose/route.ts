// POST /api/webmaster/promo-codes/[id]/propose — Propose offer to butchers
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const proposeSchema = z.object({
  shopIds: z.array(z.string()).min(1).max(50),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const body = await req.json();
    const { shopIds } = proposeSchema.parse(body);

    // Verify promo code exists
    const pc = await prisma.promoCode.findUnique({ where: { id } });
    if (!pc) return apiError("NOT_FOUND", "Code promo introuvable");

    // Create a BUTCHER_PROMO campaign to hold the proposals
    const campaign = await prisma.marketingCampaign.create({
      data: {
        name: `Proposition: ${pc.label}`,
        type: "BUTCHER_PROMO",
        status: "ACTIVE",
        segment: "BUTCHERS",
        targetShopIds: shopIds,
        createdById: auth.userId,
        startsAt: pc.startsAt,
        endsAt: pc.endsAt,
      },
    });

    // Link promo code to campaign
    await prisma.promoCode.update({
      where: { id },
      data: { campaignId: campaign.id },
    });

    // Create opt-in proposals for each shop (skip duplicates)
    const created = await prisma.butcherOptIn.createMany({
      data: shopIds.map((shopId) => ({
        campaignId: campaign.id,
        shopId,
        status: "PENDING",
      })),
      skipDuplicates: true,
    });

    return apiSuccess({ campaignId: campaign.id, proposed: created.count });
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/propose/POST");
  }
}
