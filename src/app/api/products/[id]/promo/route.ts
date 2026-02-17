import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const promoSchema = z.object({
  promoPct: z.number().min(1).max(90).nullable(),
  promoType: z.enum(["PERCENTAGE", "FLASH", "BUY_X_GET_Y"]).nullable().optional(),
  promoEnd: z.string().nullable().optional(),
});

// ── PATCH /api/products/[id]/promo ───────────
// Boucher (owner) — quick promo toggle
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { shop: { select: { ownerId: true } } },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }
    if (product.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const body = await req.json();
    const data = promoSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.promoPct === null) {
      // Disable promo
      updateData.promoPct = null;
      updateData.promoType = null;
      updateData.promoEnd = null;
    } else {
      updateData.promoPct = data.promoPct;
      updateData.promoType = data.promoType || "PERCENTAGE";
      updateData.promoEnd = data.promoEnd ? new Date(data.promoEnd) : null;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        promoPct: true,
        promoType: true,
        promoEnd: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
