import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const validateProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(50),
});

export const dynamic = "force-dynamic";

// POST /api/shops/[id]/products/validate
// Check which product IDs still exist in the shop
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shopId } = await params;
    const body = await req.json();
    const { productIds: ids } = validateProductsSchema.parse(body);

    const existing = await prisma.product.findMany({
      where: { id: { in: ids }, shopId },
      select: { id: true, inStock: true, snoozeType: true },
    });

    const existingIds = new Set(existing.map((p) => p.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    // Also flag out-of-stock or snoozed products
    const unavailableIds = existing
      .filter((p) => !p.inStock || p.snoozeType !== "NONE")
      .map((p) => p.id);

    return apiSuccess({ missingIds, unavailableIds });
  } catch (error) {
    return handleApiError(error, "shops/[id]/products/validate");
  }
}
