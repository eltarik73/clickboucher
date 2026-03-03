// src/app/api/dashboard/campaigns/route.ts — List & create campaigns (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { createCampaignSchema } from "@/lib/validations/campaign";

export const dynamic = "force-dynamic";

// ── GET — List campaigns (filterable by audience, status) ─────
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = req.nextUrl;
    const audience = searchParams.get("audience");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (audience) {
      where.audience = { contains: audience };
    }
    if (status) {
      where.status = status;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        offer: {
          select: { id: true, name: true, code: true, type: true, discountValue: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess(campaigns);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns GET");
  }
}

// ── POST — Create campaign ────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = createCampaignSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        title: data.title,
        type: data.type,
        audience: data.audience,
        subject: data.subject,
        body: data.body,
        visualTitle: data.visualTitle ?? null,
        visualSubtitle: data.visualSubtitle ?? null,
        visualColor: data.visualColor ?? null,
        visualImageUrl: data.visualImageUrl ?? null,
        offerId: data.offerId ?? null,
        status: data.status ?? "DRAFT",
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
      include: {
        offer: {
          select: { id: true, name: true, code: true, type: true, discountValue: true },
        },
      },
    });

    return apiSuccess(campaign, 201);
  } catch (error) {
    return handleApiError(error, "dashboard/campaigns POST");
  }
}
