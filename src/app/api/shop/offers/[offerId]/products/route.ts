// POST /api/shop/offers/[offerId]/products — Boucher selects eligible products
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  productIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = schema.parse(body);

    // Verify the offer exists and the proposal is accepted
    const proposal = await prisma.offerProposal.findFirst({
      where: { offerId: params.offerId, shopId: auth.shopId, status: "ACCEPTED" },
    });

    // Also allow if it's the boucher's own offer
    const ownOffer = await prisma.offer.findFirst({
      where: { id: params.offerId, shopId: auth.shopId },
    });

    if (!proposal && !ownOffer) {
      return apiError("FORBIDDEN", "Vous n'avez pas accès à cette offre");
    }

    // Verify products belong to this shop
    const products = await prisma.product.findMany({
      where: { id: { in: data.productIds }, shopId: auth.shopId },
      select: { id: true },
    });
    const validIds = products.map((p) => p.id);

    if (validIds.length === 0) {
      return apiError("VALIDATION_ERROR", "Aucun produit valide trouvé");
    }

    // Clear existing and add new
    await prisma.offerProduct.deleteMany({
      where: { offerId: params.offerId, shopId: auth.shopId },
    });

    const result = await prisma.offerProduct.createMany({
      data: validIds.map((productId) => ({
        offerId: params.offerId,
        productId,
        shopId: auth.shopId,
      })),
    });

    return apiSuccess({ selected: result.count });
  } catch (error) {
    return handleApiError(error, "shop/offers/[offerId]/products/POST");
  }
}
