import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { reorderProductsSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── PATCH /api/products/reorder ────────────────
// Boucher (owner) or Admin — reorder products
export async function PATCH(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const { shopId, productIds } = reorderProductsSchema.parse(body);

    // Verify ownership or admin
    if (role !== "admin") {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { ownerId: true },
      });
      if (!shop) {
        return apiError("NOT_FOUND", "Boucherie introuvable");
      }
      if (shop.ownerId !== userId) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
    }

    // Update displayOrder for each product
    await prisma.$transaction(
      productIds.map((id, index) =>
        prisma.product.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );

    return apiSuccess({ reordered: productIds.length });
  } catch (error) {
    return handleApiError(error);
  }
}
