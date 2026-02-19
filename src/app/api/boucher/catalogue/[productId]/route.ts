import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const patchCatalogueSchema = z.object({
  inStock: z.boolean().optional(),
  stockQty: z.number().int().min(0).optional(),
  priceCents: z.number().int().min(0).optional(),
  proPriceCents: z.number().int().min(0).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Au moins un champ requis",
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const body = await req.json();
    const parsed = patchCatalogueSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Données invalides");
    }

    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      include: { shop: { select: { ownerId: true } } },
    });
    if (!product) return apiError("NOT_FOUND", "Produit introuvable");
    if (product.shop.ownerId !== userId) return apiError("FORBIDDEN", "Accès refusé");

    const updated = await prisma.product.update({
      where: { id: params.productId },
      data: parsed.data,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
