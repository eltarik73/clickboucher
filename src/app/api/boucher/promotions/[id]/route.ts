// /api/boucher/promotions/[id] — Update/delete boucher promo
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// PATCH — Toggle active or update promo
const updateSchema = z.object({
  isActive: z.boolean().optional(),
  label: z.string().min(1).max(100).optional(),
  endsAt: z.string().datetime().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const promo = await prisma.promotion.findFirst({
      where: { id: params.id, shopId, source: "SHOP" },
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
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/promotions/PATCH");
  }
}

// DELETE — Delete promo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const promo = await prisma.promotion.findFirst({
      where: { id: params.id, shopId, source: "SHOP" },
    });
    if (!promo) return apiError("NOT_FOUND", "Promotion introuvable");

    await prisma.promotion.delete({ where: { id: params.id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/promotions/DELETE");
  }
}
