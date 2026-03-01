import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

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
    const productIds: string[] = body.productIds;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return apiError("VALIDATION_ERROR", "productIds requis");
    }

    // Cap at 50 to prevent abuse
    const ids = productIds.slice(0, 50);

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
