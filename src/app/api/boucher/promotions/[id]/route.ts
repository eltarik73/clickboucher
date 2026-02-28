// /api/boucher/promotions/[id] — Update/delete boucher promo + accept/reject proposals
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// PATCH — Toggle active, update promo, OR accept/reject proposal
const updateSchema = z.object({
  isActive: z.boolean().optional(),
  label: z.string().min(1).max(100).optional(),
  endsAt: z.string().datetime().optional(),
  // Proposal actions
  action: z.enum(["accept", "reject"]).optional(),
  rejectedReason: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Handle proposal accept/reject
    if (data.action === "accept" || data.action === "reject") {
      const proposal = await prisma.promotion.findFirst({
        where: { id: params.id, shopId, proposalStatus: "PROPOSED" },
      });
      if (!proposal) return apiError("NOT_FOUND", "Proposition introuvable");

      if (data.action === "accept") {
        const updated = await prisma.promotion.update({
          where: { id: params.id },
          data: { proposalStatus: "ACCEPTED", isActive: true },
        });
        return apiSuccess(updated);
      } else {
        const updated = await prisma.promotion.update({
          where: { id: params.id },
          data: {
            proposalStatus: "REJECTED",
            isActive: false,
            rejectedReason: data.rejectedReason || null,
          },
        });
        return apiSuccess(updated);
      }
    }

    // Standard promo update (boucher's own promos)
    const promo = await prisma.promotion.findFirst({
      where: { id: params.id, shopId, source: "SHOP", proposalStatus: null },
    });
    if (!promo) return apiError("NOT_FOUND", "Promotion introuvable");

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

// DELETE — Delete promo (only boucher's own)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const promo = await prisma.promotion.findFirst({
      where: { id: params.id, shopId, source: "SHOP", proposalStatus: null },
    });
    if (!promo) return apiError("NOT_FOUND", "Promotion introuvable");

    await prisma.promotion.delete({ where: { id: params.id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/promotions/DELETE");
  }
}
