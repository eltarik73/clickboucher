export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";
import { z } from "zod";

const reorderSchema = z.object({
  shopId: z.string().min(1),
  categoryIds: z.array(z.string().min(1)).min(1),
});

// ── PATCH /api/categories/reorder ──
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const body = await req.json();
    const { shopId, categoryIds } = reorderSchema.parse(body);

    // Verify ownership
    const user = await currentUser();
    const role = (user?.publicMetadata as Record<string, string>)?.role;
    if (!isAdmin(role)) {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { ownerId: true },
      });
      if (!shop) return apiError("NOT_FOUND", "Boucherie introuvable");
      if (shop.ownerId !== userId) return apiError("FORBIDDEN", "Non autorise");
    }

    // Validate all categories belong to this shop
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, shopId: true },
    });
    const allBelongToShop = categories.length === categoryIds.length &&
      categories.every((c) => c.shopId === shopId);
    if (!allBelongToShop) {
      return apiError("FORBIDDEN", "Certaines categories n'appartiennent pas a cette boucherie");
    }

    // Batch update order
    await prisma.$transaction(
      categoryIds.map((id, index) =>
        prisma.category.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    return apiSuccess({ reordered: true });
  } catch (error) {
    return handleApiError(error);
  }
}
