// src/app/api/dashboard/campaigns/[campaignId]/route.ts — Get, update, delete campaign (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { updateCampaignSchema } from "@/lib/validations/campaign";

export const dynamic = "force-dynamic";

type Params = { params: { campaignId: string } };

// ── GET — Get campaign by ID ──────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { campaignId } = params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        offer: {
          select: { id: true, name: true, code: true, type: true, discountValue: true },
        },
      },
    });

    if (!campaign) {
      return apiError("NOT_FOUND", "Campagne introuvable");
    }

    return apiSuccess(campaign);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[id] GET");
  }
}

// ── PATCH — Update campaign ───────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { campaignId } = params;

    const existing = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!existing) {
      return apiError("NOT_FOUND", "Campagne introuvable");
    }

    const body = await req.json();
    const data = updateCampaignSchema.parse(body);

    const updateData: Record<string, unknown> = { ...data };

    // Parse scheduledAt string to Date if present
    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        offer: {
          select: { id: true, name: true, code: true, type: true, discountValue: true },
        },
      },
    });

    return apiSuccess(campaign);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[id] PATCH");
  }
}

// ── DELETE — Delete campaign (only drafts) ────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
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

    if (campaign.status !== "DRAFT") {
      return apiError("VALIDATION_ERROR", "Seuls les brouillons peuvent être supprimés");
    }

    await prisma.campaign.delete({ where: { id: campaignId } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/[id] DELETE");
  }
}
