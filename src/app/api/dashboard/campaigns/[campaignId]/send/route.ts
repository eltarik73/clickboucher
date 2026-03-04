// src/app/api/dashboard/campaigns/[campaignId]/send/route.ts — Send campaign emails (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { executeCampaignSend } from "@/lib/marketing/send-campaign";

export const dynamic = "force-dynamic";

type Params = { params: { campaignId: string } };

// ── POST — Send campaign emails to recipients ────────────────
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { campaignId } = params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true },
    });

    if (!campaign) {
      return apiError("NOT_FOUND", "Campagne introuvable");
    }

    if (campaign.status === "SENT") {
      return apiError("CONFLICT", "Cette campagne a déjà été envoyée");
    }

    const result = await executeCampaignSend(campaignId);

    return apiSuccess({
      sent: result.sent,
      total: result.total,
      message: result.total === 0
        ? "Aucun destinataire trouvé pour cette audience"
        : `${result.sent} email${result.sent > 1 ? "s" : ""} envoyé${result.sent > 1 ? "s" : ""} sur ${result.total}`,
    });
  } catch (error) {
    // Revert to DRAFT on failure
    try {
      await prisma.campaign.update({
        where: { id: params.campaignId },
        data: { status: "DRAFT" },
      });
    } catch {
      // silent
    }
    return handleApiError(error, "dashboard/campaigns/[id]/send POST");
  }
}
