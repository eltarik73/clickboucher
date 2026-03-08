// src/app/api/boucher/anti-gaspi/[productId]/route.ts — Update/disable anti-gaspi
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { updateAntiGaspiSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** PATCH — Update anti-gaspi settings */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const product = await prisma.product.findFirst({
      where: { id: productId, shopId },
    });
    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    const body = await req.json();
    const data = updateAntiGaspiSchema.parse(body);

    // Disable anti-gaspi — restore original price
    if (data.disable) {
      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          isAntiGaspi: false,
          priceCents: product.antiGaspiOrigPriceCents ?? product.priceCents,
          antiGaspiOrigPriceCents: null,
          antiGaspiStock: null,
          antiGaspiEndAt: null,
          antiGaspiReason: null,
        },
      });
      return apiSuccess(updated);
    }

    // Update fields
    const updateData: Record<string, unknown> = {};

    if (data.discountPercent !== undefined && product.antiGaspiOrigPriceCents) {
      updateData.priceCents = Math.round(
        product.antiGaspiOrigPriceCents * (1 - data.discountPercent / 100)
      );
    }
    if (data.antiGaspiStock !== undefined) {
      updateData.antiGaspiStock = data.antiGaspiStock;
    }
    if (data.reason !== undefined) {
      updateData.antiGaspiReason = data.reason;
    }
    if (data.endAt !== undefined) {
      updateData.antiGaspiEndAt = new Date(data.endAt);
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/anti-gaspi/PATCH");
  }
}

/** DELETE — Disable anti-gaspi (shortcut) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const product = await prisma.product.findFirst({
      where: { id: productId, shopId },
    });
    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        isAntiGaspi: false,
        priceCents: product.antiGaspiOrigPriceCents ?? product.priceCents,
        antiGaspiOrigPriceCents: null,
        antiGaspiStock: null,
        antiGaspiEndAt: null,
        antiGaspiReason: null,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/anti-gaspi/DELETE");
  }
}
