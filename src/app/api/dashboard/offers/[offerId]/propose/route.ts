// POST /api/dashboard/offers/[offerId]/propose — Propose offer to butchers
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { proposeOfferSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const offer = await prisma.offer.findUnique({ where: { id: params.offerId } });
    if (!offer) return apiError("NOT_FOUND", "Offre introuvable");

    const body = await req.json();
    const data = proposeOfferSchema.parse(body);

    // Check for existing proposals
    const existing = await prisma.offerProposal.findMany({
      where: { offerId: params.offerId, shopId: { in: data.shopIds } },
      select: { shopId: true },
    });
    const existingIds = new Set(existing.map((e) => e.shopId));
    const newShopIds = data.shopIds.filter((id) => !existingIds.has(id));

    if (newShopIds.length === 0) {
      return apiError("VALIDATION_ERROR", "Toutes ces boucheries ont déjà reçu cette proposition");
    }

    const proposals = await prisma.offerProposal.createMany({
      data: newShopIds.map((shopId) => ({
        offerId: params.offerId,
        shopId,
      })),
    });

    return apiSuccess({ created: proposals.count, skipped: existingIds.size });
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/propose/POST");
  }
}
