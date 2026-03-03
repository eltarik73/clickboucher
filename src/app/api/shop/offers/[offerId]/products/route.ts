// src/app/api/shop/offers/[offerId]/products/route.ts — Manage eligible products for an offer
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/shop/offers/[offerId]/products
 * List eligible products for an offer (scoped to boucher's shop)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { offerId } = params;

    const offerProducts = await prisma.offerProduct.findMany({
      where: { offerId, shopId: auth.shopId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            priceCents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(offerProducts);
  } catch (error) {
    return handleApiError(error, "shop/offers/products GET");
  }
}

/**
 * POST /api/shop/offers/[offerId]/products
 * Add eligible products to an offer (scoped to boucher's shop)
 * Body: { productIds: string[] }
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
    const productIds: string[] = body.productIds;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return apiError("VALIDATION_ERROR", "productIds requis (tableau non vide)");
    }

    // Verify the offer exists and belongs to or is proposed to this shop
    const offer = await prisma.offer.findFirst({
      where: {
        id: offerId,
        OR: [
          { shopId: auth.shopId },
          { proposals: { some: { shopId: auth.shopId, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!offer) {
      return apiError("NOT_FOUND", "Offre introuvable ou non autorisée");
    }

    // Create OfferProduct entries (skip duplicates)
    await prisma.offerProduct.createMany({
      data: productIds.map((productId) => ({
        offerId,
        productId,
        shopId: auth.shopId,
      })),
      skipDuplicates: true,
    });

    // Return the full list after creation
    const offerProducts = await prisma.offerProduct.findMany({
      where: { offerId, shopId: auth.shopId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            priceCents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(offerProducts, 201);
  } catch (error) {
    return handleApiError(error, "shop/offers/products POST");
  }
}
