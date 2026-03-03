// PATCH/DELETE /api/webmaster/marketing-campaigns/[id] — Update or delete campaign
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  subject: z.string().max(200).optional(),
  htmlContent: z.string().optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  popupTitle: z.string().max(200).optional(),
  popupMessage: z.string().max(1000).optional(),
  bannerText: z.string().max(200).optional(),
  segment: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  // Actions
  action: z.enum(["activate", "send_email", "pause", "complete"]).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Handle actions
    if (data.action === "activate") {
      const updated = await prisma.marketingCampaign.update({
        where: { id },
        data: { status: "ACTIVE", startsAt: new Date() },
      });
      return apiSuccess(updated);
    }

    if (data.action === "pause") {
      const updated = await prisma.marketingCampaign.update({
        where: { id },
        data: { status: "PAUSED" },
      });
      return apiSuccess(updated);
    }

    if (data.action === "complete") {
      const updated = await prisma.marketingCampaign.update({
        where: { id },
        data: { status: "COMPLETED" },
      });
      return apiSuccess(updated);
    }

    if (data.action === "send_email") {
      // For email campaigns, trigger send (reuse existing email logic)
      if (campaign.type !== "EMAIL") {
        return apiError("VALIDATION_ERROR", "Action disponible uniquement pour les campagnes email");
      }
      // Mark as sent
      const updated = await prisma.marketingCampaign.update({
        where: { id },
        data: { status: "COMPLETED", sentAt: new Date() },
      });
      // TODO: Actually send emails using Resend (reuse existing campaign send logic)
      return apiSuccess(updated);
    }

    // Standard update
    const updated = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.status && { status: data.status }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.htmlContent !== undefined && { htmlContent: data.htmlContent }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.linkUrl !== undefined && { linkUrl: data.linkUrl }),
        ...(data.popupTitle !== undefined && { popupTitle: data.popupTitle }),
        ...(data.popupMessage !== undefined && { popupMessage: data.popupMessage }),
        ...(data.bannerText !== undefined && { bannerText: data.bannerText }),
        ...(data.segment !== undefined && { segment: data.segment }),
        ...(data.startsAt && { startsAt: new Date(data.startsAt) }),
        ...(data.endsAt && { endsAt: new Date(data.endsAt) }),
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "webmaster/marketing-campaigns/PATCH");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");

    // Delete related opt-ins and promo code links first
    await prisma.butcherOptIn.deleteMany({ where: { campaignId: id } });
    await prisma.marketingCampaign.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "webmaster/marketing-campaigns/DELETE");
  }
}
