// src/app/api/dashboard/offers/[offerId]/products/route.ts — Manage eligible products for offer (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: { offerId: string } };

const addProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "Au moins un produit requis"),
  shopId: z.string().min(1, "shopId requis"),
});

const removeProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "Au moins un produit requis"),
});

// ── POST — Add eligible products ─────────────────────────────
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { offerId } = params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });
    if (!offer) {
      return apiError("NOT_FOUND", "Offre introuvable");
    }

    const body = await req.json();
    const data = addProductsSchema.parse(body);

    const result = await prisma.offerProduct.createMany({
      data: data.productIds.map((productId) => ({
        offerId,
        productId,
        shopId: data.shopId,
      })),
      skipDuplicates: true,
    });

    return apiSuccess({ created: result.count }, 201);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/products POST");
  }
}

// ── DELETE — Remove eligible products ────────────────────────
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { offerId } = params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });
    if (!offer) {
      return apiError("NOT_FOUND", "Offre introuvable");
    }

    const body = await req.json();
    const data = removeProductsSchema.parse(body);

    const result = await prisma.offerProduct.deleteMany({
      where: {
        offerId,
        productId: { in: data.productIds },
      },
    });

    return apiSuccess({ deleted: result.count });
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/products DELETE");
  }
}
