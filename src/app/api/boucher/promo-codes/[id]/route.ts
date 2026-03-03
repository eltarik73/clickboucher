// PATCH/DELETE /api/boucher/promo-codes/[id] — Update or delete boucher promo code
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  endsAt: z.string().datetime().optional(),
  maxUses: z.number().int().min(1).optional(),
});

// ── PATCH — Update promo code ──
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { id } = await ctx.params;
    const pc = await prisma.promoCode.findFirst({
      where: { id, shopId: auth.shopId, scope: "SHOP" },
    });
    if (!pc) return apiError("NOT_FOUND", "Code promo introuvable");

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(data.label && { label: data.label }),
        ...(data.status && { status: data.status }),
        ...(data.endsAt && { endsAt: new Date(data.endsAt) }),
        ...(data.maxUses && { maxUses: data.maxUses }),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/promo-codes/PATCH");
  }
}

// ── DELETE — Delete promo code ──
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { id } = await ctx.params;
    const pc = await prisma.promoCode.findFirst({
      where: { id, shopId: auth.shopId, scope: "SHOP" },
    });
    if (!pc) return apiError("NOT_FOUND", "Code promo introuvable");

    await prisma.promoCode.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/promo-codes/DELETE");
  }
}
