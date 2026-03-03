// GET/POST /api/dashboard/campaigns — Webmaster campaign management
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { createCampaignSchema } from "@/lib/validations/campaign";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const audience = req.nextUrl.searchParams.get("audience");
    const status = req.nextUrl.searchParams.get("status");

    const campaigns = await prisma.campaign.findMany({
      where: {
        ...(audience && audience !== "all" ? { audience: audience as any } : {}),
        ...(status && status !== "all" ? { status: status as any } : {}),
      },
      include: {
        offer: { select: { id: true, code: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess(campaigns);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const data = createCampaignSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        title: data.title,
        type: data.type,
        audience: data.audience,
        subject: data.subject,
        body: data.body,
        visualTitle: data.visualTitle,
        visualSubtitle: data.visualSubtitle,
        visualColor: data.visualColor,
        visualImageUrl: data.visualImageUrl,
        offerId: data.offerId,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.scheduledAt ? "SCHEDULED" : "DRAFT",
      },
    });

    return apiSuccess(campaign);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns/POST");
  }
}
