// /api/webmaster/campaigns/[id] — Campaign detail + send
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendCampaign } from "@/lib/services/campaign.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

// PATCH — Update campaign (edit or send)
const updateSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  htmlContent: z.string().optional(),
  action: z.enum(["update", "send"]).default("update"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");

    const body = await req.json();
    const data = updateSchema.parse(body);

    if (data.action === "send") {
      if (campaign.status === "SENT") {
        return apiError("VALIDATION_ERROR", "Campagne déjà envoyée");
      }
      const result = await sendCampaign(campaign.id);
      const updated = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      return apiSuccess({ ...updated, sentResult: result });
    }

    // Update draft
    const updated = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...(data.subject && { subject: data.subject }),
        ...(data.htmlContent && { htmlContent: data.htmlContent }),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "webmaster/campaigns/[id]/PATCH");
  }
}

// DELETE — Delete a draft campaign
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
    if (!campaign) return apiError("NOT_FOUND", "Campagne introuvable");

    await prisma.campaign.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "webmaster/campaigns/[id]/DELETE");
  }
}
