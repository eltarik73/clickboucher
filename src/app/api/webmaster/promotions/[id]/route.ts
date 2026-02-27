// /api/webmaster/promotions/[id] — Update/delete platform promo
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  label: z.string().min(1).max(100).optional(),
  endsAt: z.string().datetime().optional(),
  maxUses: z.number().int().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const promo = await prisma.promotion.findUnique({
      where: { id: params.id },
    });
    if (!promo) return apiError("NOT_FOUND", "Promotion introuvable");

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.promotion.update({
      where: { id: params.id },
      data: {
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.label && { label: data.label }),
        ...(data.endsAt && { endsAt: new Date(data.endsAt) }),
        ...(data.maxUses && { maxUses: data.maxUses }),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "webmaster/promotions/[id]/PATCH");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const promo = await prisma.promotion.findUnique({
      where: { id: params.id },
    });
    if (!promo) return apiError("NOT_FOUND", "Promotion introuvable");

    await prisma.promotion.delete({ where: { id: params.id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "webmaster/promotions/[id]/DELETE");
  }
}
