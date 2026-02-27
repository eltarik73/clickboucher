// API: POST /api/webmaster/catalog/promote — Promote a boucher Product to ReferenceProduct
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { promoteProductSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const body = await req.json();
    const { productId, categoryId } = promoteProductSchema.parse(body);

    // Fetch the boucher product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        priceCents: true,
        unit: true,
        origin: true,
        tags: true,
      },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    // Check category exists
    const category = await prisma.globalCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      return apiError("NOT_FOUND", "Categorie introuvable");
    }

    // Check for duplicate name in reference catalog
    const existing = await prisma.referenceProduct.findFirst({
      where: { name: { equals: product.name, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    if (existing) {
      return apiError("CONFLICT", `Un produit reference "${existing.name}" existe deja`);
    }

    // Create reference product from boucher product
    const refProduct = await prisma.referenceProduct.create({
      data: {
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        suggestedPrice: product.priceCents,
        unit: product.unit as "KG" | "PIECE" | "BARQUETTE" | "TRANCHE",
        categoryId,
        origin: product.origin as "FRANCE" | "EU" | "ESPAGNE" | "IRLANDE" | "BELGIQUE" | "ALLEMAGNE" | "NOUVELLE_ZELANDE" | "BRESIL" | "POLOGNE" | "ITALIE" | "UK" | "AUTRE" | undefined,
        tags: product.tags || [],
        isActive: true,
      },
      include: { category: true },
    });

    // Link the original product to the new reference
    await prisma.product.update({
      where: { id: productId },
      data: { referenceId: refProduct.id },
    });

    return apiSuccess(refProduct, 201);
  } catch (error) {
    return handleApiError(error, "POST /api/webmaster/catalog/promote");
  }
}
