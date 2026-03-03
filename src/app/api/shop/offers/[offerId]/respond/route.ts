// POST /api/shop/offers/[offerId]/respond — Boucher accepts/rejects proposal
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  accept: z.boolean(),
});

export async function POST(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = schema.parse(body);

    const proposal = await prisma.offerProposal.findFirst({
      where: { offerId: params.offerId, shopId: auth.shopId },
    });

    if (!proposal) return apiError("NOT_FOUND", "Proposition introuvable");
    if (proposal.status !== "PENDING") return apiError("VALIDATION_ERROR", "Cette proposition a déjà été traitée");

    const updated = await prisma.offerProposal.update({
      where: { id: proposal.id },
      data: {
        status: data.accept ? "ACCEPTED" : "REJECTED",
        respondedAt: new Date(),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "shop/offers/[offerId]/respond/POST");
  }
}
