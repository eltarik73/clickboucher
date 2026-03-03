// GET/POST /api/webmaster/marketing-campaigns — Campaign management
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET — List marketing campaigns ──
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const type = req.nextUrl.searchParams.get("type");
    const status = req.nextUrl.searchParams.get("status");

    const campaigns = await prisma.marketingCampaign.findMany({
      where: {
        ...(type && type !== "all" ? { type: type as "EMAIL" | "BANNER" | "POPUP" | "PUSH" | "BUTCHER_PROMO" } : {}),
        ...(status && status !== "all" ? { status: status as "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED" } : {}),
      },
      include: {
        promoCodes: {
          select: { id: true, code: true, discountType: true, valueCents: true, valuePercent: true, status: true },
        },
        optIns: {
          select: { id: true, shopId: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Stats
    const stats = {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === "ACTIVE").length,
      drafts: campaigns.filter((c) => c.status === "DRAFT").length,
      totalImpressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
      totalSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
    };

    return apiSuccess({ campaigns, stats });
  } catch (error) {
    return handleApiError(error, "webmaster/marketing-campaigns/GET");
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["EMAIL", "BANNER", "POPUP", "PUSH", "BUTCHER_PROMO"]),
  subject: z.string().max(200).optional(),
  htmlContent: z.string().optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  popupTitle: z.string().max(200).optional(),
  popupMessage: z.string().max(1000).optional(),
  bannerText: z.string().max(200).optional(),
  segment: z.string().default("ALL"),
  targetShopIds: z.array(z.string()).default([]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
});

// ── POST — Create campaign ──
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const data = createSchema.parse(body);

    const campaign = await prisma.marketingCampaign.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject,
        htmlContent: data.htmlContent,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl,
        popupTitle: data.popupTitle,
        popupMessage: data.popupMessage,
        bannerText: data.bannerText,
        segment: data.segment,
        targetShopIds: data.targetShopIds,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.scheduledAt ? "SCHEDULED" : "DRAFT",
        createdById: auth.userId,
      },
    });

    // If BUTCHER_PROMO, create opt-ins for target shops
    if (data.type === "BUTCHER_PROMO" && data.targetShopIds.length > 0) {
      await prisma.butcherOptIn.createMany({
        data: data.targetShopIds.map((shopId) => ({
          campaignId: campaign.id,
          shopId,
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
    }

    return apiSuccess(campaign);
  } catch (error) {
    return handleApiError(error, "webmaster/marketing-campaigns/POST");
  }
}
