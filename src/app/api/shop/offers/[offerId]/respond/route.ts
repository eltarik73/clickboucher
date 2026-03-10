// src/app/api/shop/offers/[offerId]/respond/route.ts — Accept/reject a webmaster proposal
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const respondSchema = z.object({
  accept: z.boolean(),
});

export const dynamic = "force-dynamic";

/**
 * POST /api/shop/offers/[offerId]/respond
 * Accept or reject a webmaster offer proposal
 * Body: { accept: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { offerId } = params;
    const body = await req.json();
    const { accept } = respondSchema.parse(body);

    // Find the proposal for this offer + this boucher's shop
    const proposal = await prisma.offerProposal.findFirst({
      where: { offerId, shopId: auth.shopId },
    });

    if (!proposal) {
      return apiError("NOT_FOUND", "Proposition introuvable");
    }

    if (proposal.status !== "PENDING") {
      return apiError("CONFLICT", "Cette proposition a déjà été traitée");
    }

    // Update proposal status
    const updated = await prisma.offerProposal.update({
      where: { id: proposal.id },
      data: {
        status: accept ? "ACCEPTED" : "REJECTED",
        respondedAt: new Date(),
      },
      include: {
        offer: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            discountValue: true,
          },
        },
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "shop/offers/respond POST");
  }
}
