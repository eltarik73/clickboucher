import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { updateProductSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { order: "asc" as const } },
  labels: true,
  shop: { select: { id: true, name: true, slug: true } },
};

// ── GET /api/products/[id] ─────────────────────
// Public — product detail with all relations
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    return apiSuccess(product);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── PATCH /api/products/[id] ───────────────────
// Boucher (owner) or Admin — update product
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Find product + shop owner
    const product = await prisma.product.findUnique({
      where: { id },
      select: { shopId: true, shop: { select: { ownerId: true } } },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    if (role !== "admin" && product.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const body = await req.json();
    const data = updateProductSchema.parse(body);

    // If categoryId is changed, verify it belongs to the same shop
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { shopId: true },
      });
      if (!category || category.shopId !== product.shopId) {
        return apiError("VALIDATION_ERROR", "La catégorie n'appartient pas à cette boucherie");
      }
    }

    // Separate images/labels from scalar fields
    const { images, labels, promoEnd, ...scalarData } = data;

    const updateData: Record<string, unknown> = { ...scalarData };
    if (promoEnd !== undefined) {
      updateData.promoEnd = promoEnd ? new Date(promoEnd) : null;
    }

    // Replace images if provided (delete old, create new)
    if (images !== undefined) {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (images.length > 0) {
        updateData.images = {
          create: images.map((img) => ({
            url: img.url,
            alt: img.alt,
            order: img.order,
            isPrimary: img.isPrimary,
          })),
        };
      }
    }

    // Replace labels if provided (delete old, create new with productId)
    if (labels !== undefined) {
      // Delete all current labels for this product
      await prisma.productLabel.deleteMany({ where: { productId: id } });

      // Create new labels if any
      if (labels.length > 0) {
        updateData.labels = {
          create: labels.map((l) => ({
            name: l.name,
            color: l.color,
          })),
        };
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        images: { orderBy: { order: "asc" } },
        labels: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/products/[id] ──────────────────
// Boucher (owner) or Admin — delete product
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        shop: { select: { ownerId: true } },
        _count: { select: { orderItems: true } },
      },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    if (role !== "admin" && product.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    // Cascade: images and labels are deleted via onDelete: Cascade
    await prisma.product.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
