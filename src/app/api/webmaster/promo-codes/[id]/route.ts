// PATCH/DELETE /api/webmaster/promo-codes/[id] — Update or delete promo code
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]).optional(),
  endsAt: z.string().datetime().optional(),
  maxUses: z.number().int().min(1).optional(),
  audience: z.enum(["ALL", "NEW_CLIENTS", "LOYAL_CLIENTS", "INACTIVE_CLIENTS", "PRO_CLIENTS"]).optional(),
  // Diffusion
  diffBadge: z.boolean().optional(),
  diffBanner: z.boolean().optional(),
  diffPopup: z.boolean().optional(),
  // Banner visuals
  bannerTitle: z.string().max(100).nullable().optional(),
  bannerSubtitle: z.string().max(200).nullable().optional(),
  bannerColor: z.enum(["red", "black", "green", "orange", "blue"]).optional(),
  bannerPosition: z.enum(["discover_top", "shop_page", "all_pages"]).optional(),
  bannerImageUrl: z.string().nullable().optional(),
  // Popup visuals
  popupTitle: z.string().max(100).nullable().optional(),
  popupMessage: z.string().max(500).nullable().optional(),
  popupColor: z.enum(["red", "black", "green", "orange", "blue"]).optional(),
  popupFrequency: z.enum(["once_user", "once_day", "every_visit"]).optional(),
  popupImageUrl: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const pc = await prisma.promoCode.findUnique({ where: { id } });
    if (!pc) return apiError("NOT_FOUND", "Code promo introuvable");

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Build update payload (only provided fields)
    const updateData: Record<string, unknown> = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status) updateData.status = data.status;
    if (data.endsAt) updateData.endsAt = new Date(data.endsAt);
    if (data.maxUses) updateData.maxUses = data.maxUses;
    if (data.audience) updateData.audience = data.audience;
    // Diffusion
    if (data.diffBadge !== undefined) updateData.diffBadge = data.diffBadge;
    if (data.diffBanner !== undefined) updateData.diffBanner = data.diffBanner;
    if (data.diffPopup !== undefined) updateData.diffPopup = data.diffPopup;
    // Banner
    if (data.bannerTitle !== undefined) updateData.bannerTitle = data.bannerTitle;
    if (data.bannerSubtitle !== undefined) updateData.bannerSubtitle = data.bannerSubtitle;
    if (data.bannerColor !== undefined) updateData.bannerColor = data.bannerColor;
    if (data.bannerPosition !== undefined) updateData.bannerPosition = data.bannerPosition;
    if (data.bannerImageUrl !== undefined) updateData.bannerImageUrl = data.bannerImageUrl;
    // Popup
    if (data.popupTitle !== undefined) updateData.popupTitle = data.popupTitle;
    if (data.popupMessage !== undefined) updateData.popupMessage = data.popupMessage;
    if (data.popupColor !== undefined) updateData.popupColor = data.popupColor;
    if (data.popupFrequency !== undefined) updateData.popupFrequency = data.popupFrequency;
    if (data.popupImageUrl !== undefined) updateData.popupImageUrl = data.popupImageUrl;

    const updated = await prisma.promoCode.update({
      where: { id },
      data: updateData,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/PATCH");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const { id } = await ctx.params;
    const pc = await prisma.promoCode.findUnique({ where: { id } });
    if (!pc) return apiError("NOT_FOUND", "Code promo introuvable");

    await prisma.promoCode.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/DELETE");
  }
}
