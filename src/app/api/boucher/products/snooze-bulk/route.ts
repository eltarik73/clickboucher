// src/app/api/boucher/products/snooze-bulk/route.ts — Deliveroo bulk snooze
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { snoozeProduct } from "@/lib/product-snooze";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  productIds: z.array(z.string()).min(1).max(100),
  type: z.enum(["NONE", "ONE_HOUR", "TWO_HOURS", "END_OF_DAY", "INDEFINITE"]),
  reason: z.string().max(200).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const body = await req.json();
    const data = bulkSchema.parse(body);

    // Verify all products belong to this shop
    const products = await prisma.product.findMany({
      where: { id: { in: data.productIds }, shopId },
      select: { id: true },
    });
    if (products.length !== data.productIds.length) {
      return apiError("FORBIDDEN", "Certains produits ne vous appartiennent pas");
    }

    // Snooze all
    await Promise.all(
      data.productIds.map((id) => snoozeProduct(id, data.type, data.reason))
    );

    return apiSuccess({ updated: data.productIds.length, type: data.type });
  } catch (error) {
    return handleApiError(error, "boucher/products/snooze-bulk");
  }
}
