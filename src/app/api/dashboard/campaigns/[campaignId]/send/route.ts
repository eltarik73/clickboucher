// src/app/api/dashboard/campaigns/[campaignId]/send/route.ts — Send campaign (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

type Params = { params: { campaignId: string } };

// ── POST — Mark campaign as SENT ──────────────────────────────
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { campaignId } = params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });

    if (!campaign) {
      return apiError("NOT_FOUND", "Campagne introuvable");
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[id]/send POST");
  }
}
