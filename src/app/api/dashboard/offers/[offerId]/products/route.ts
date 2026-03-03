// POST/DELETE /api/dashboard/offers/[offerId]/products — Manage eligible products
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { offerProductsSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const offer = await prisma.offer.findUnique({ where: { id: params.offerId } });
    if (!offer) return apiError("NOT_FOUND", "Offre introuvable");

    const body = await req.json();
    const data = offerProductsSchema.parse(body);

    // Verify products belong to the shop
    const products = await prisma.product.findMany({
      where: { id: { in: data.productIds }, shopId: data.shopId },
      select: { id: true },
    });
    const validIds = products.map((p) => p.id);

    if (validIds.length === 0) {
      return apiError("VALIDATION_ERROR", "Aucun produit valide trouvé pour cette boucherie");
    }

    // Upsert (skip duplicates)
    const result = await prisma.offerProduct.createMany({
      data: validIds.map((productId) => ({
        offerId: params.offerId,
        productId,
        shopId: data.shopId,
      })),
      skipDuplicates: true,
    });

    return apiSuccess({ added: result.count });
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/products/POST");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const { productIds } = body as { productIds: string[] };

    if (!productIds?.length) return apiError("VALIDATION_ERROR", "productIds requis");

    const result = await prisma.offerProduct.deleteMany({
      where: { offerId: params.offerId, productId: { in: productIds } },
    });

    return apiSuccess({ removed: result.count });
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/products/DELETE");
  }
}
