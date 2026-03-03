// POST /api/dashboard/campaigns/[campaignId]/send — Send campaign
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendCampaign } from "@/lib/services/campaign.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const campaign = await prisma.campaign.findUnique({ where: { id: params.campaignId } });
    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");
    if (campaign.status === "SENT") return apiError("VALIDATION_ERROR", "Campagne déjà envoyée");

    // Mark as SENDING
    await prisma.campaign.update({
      where: { id: params.campaignId },
      data: { status: "SENDING" },
    });

    // Send (this updates status to SENT when done)
    const result = await sendCampaign(params.campaignId);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[campaignId]/send/POST");
  }
}
