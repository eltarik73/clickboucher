// GET/PATCH/DELETE /api/dashboard/campaigns/[campaignId]
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { updateCampaignSchema } from "@/lib/validations/campaign";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      include: { offer: { select: { id: true, code: true, name: true, type: true, discountValue: true } } },
    });

    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");
    return apiSuccess(campaign);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[campaignId]/GET");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const campaign = await prisma.campaign.findUnique({ where: { id: params.campaignId } });
    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");

    const body = await req.json();
    const data = updateCampaignSchema.parse(body);

    const updated = await prisma.campaign.update({
      where: { id: params.campaignId },
      data: {
        ...data,
        ...(data.scheduledAt === null ? { scheduledAt: null } : data.scheduledAt ? { scheduledAt: new Date(data.scheduledAt) } : {}),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[campaignId]/PATCH");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const campaign = await prisma.campaign.findUnique({ where: { id: params.campaignId } });
    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");
    if (campaign.status !== "DRAFT") return apiError("VALIDATION_ERROR", "Seules les campagnes brouillon peuvent être supprimées");

    await prisma.campaign.delete({ where: { id: params.campaignId } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[campaignId]/DELETE");
  }
}
