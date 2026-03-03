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

    const updated = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
        ...(data.endsAt && { endsAt: new Date(data.endsAt) }),
        ...(data.maxUses && { maxUses: data.maxUses }),
        ...(data.audience && { audience: data.audience }),
      },
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
