import { NextRequest } from "next/server";
import { getServerUserId, getBoucherOwnerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { updateProductSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError, privateNoStore } from "@/lib/api/errors";
import { planProductImageWriteInShop } from "@/lib/images/write-scope";
import { isAdmin } from "@/lib/roles";
import { antiGaspiEndOnPriceWrite, settleAntiGaspi } from "@/lib/pricing/anti-gaspi";
import { priceAudienceOf } from "@/lib/product-price-audience";
import {
  proProductSelect,
  publicProductSelect,
  type ProductPriceAudience,
} from "@/lib/public-projections";

export const dynamic = "force-dynamic";

const SHOP_SUMMARY = { select: { id: true, name: true, slug: true } } as const;

const PRODUCT_INCLUDE = {
  categories: true,
  images: { orderBy: { order: "asc" as const } },
  labels: true,
  shop: SHOP_SUMMARY,
};

function findProduct(id: string, audience: ProductPriceAudience) {
  if (audience === "MANAGER")
    return prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  const select = audience === "PRO" ? proProductSelect : publicProductSelect;
  return prisma.product.findUnique({ where: { id }, select: { ...select, shop: SHOP_SUMMARY } });
}

// ── GET /api/products/[id] ─────────────────────
// Public — product detail. Anonymous and ordinary callers get the allow-listed projection
// (src/lib/public-projections.ts), CLIENT_PRO also gets proPriceCents. The shop owner and admins
// get the full row: the butcher's edit form saves it back. One URL, three bodies: no response is
// ever stored by a shared cache, or the owner could be served the public body and save it back.
// Every body shows the product as it is now (an expired anti-gaspi at its original price, mode
// off): the edit form must not save an expired discount back as the price.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await findProduct(params.id, await priceAudienceOf({ productId: params.id }));
    if (!product) return privateNoStore(apiError("NOT_FOUND", "Produit introuvable"));
    return privateNoStore(apiSuccess(settleAntiGaspi(product, new Date())));
  } catch (error) {
    return privateNoStore(handleApiError(error));
  }
}

// ── PATCH /api/products/[id] ───────────────────
// Boucher (owner) or Admin — update product
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const authId = await getServerUserId();
    if (!authId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }
    const userId = await getBoucherOwnerUserId();

    // Find product + shop owner
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        shopId: true,
        shop: { select: { ownerId: true } },
        imageUrl: true,
        images: { select: { url: true } },
        isAntiGaspi: true,
        antiGaspiEndAt: true,
      },
    });

    if (!product) {
      return apiError("NOT_FOUND", "Produit introuvable");
    }

    // Check ownership: match by clerkId or DB userId
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: authId },
      select: { id: true, role: true },
    });
    if (
      !isAdmin(dbUser?.role) &&
      product.shop.ownerId !== userId &&
      product.shop.ownerId !== dbUser?.id
    ) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const body = await req.json();
    const data = updateProductSchema.parse(body);

    // If categoryIds changed, verify all belong to the same shop
    if (data.categoryIds) {
      const cats = await prisma.category.findMany({
        where: { id: { in: data.categoryIds }, shopId: product.shopId },
        select: { id: true },
      });
      if (cats.length !== data.categoryIds.length) {
        return apiError(
          "VALIDATION_ERROR",
          "Une ou plusieurs catégories n'appartiennent pas à cette boucherie"
        );
      }
    }

    // Separate photos/labels/categoryIds from scalar fields
    const {
      images,
      imageUrl,
      clearImageUrl,
      labels,
      promoEnd,
      freshDate,
      categoryIds,
      ...scalarData
    } = data;

    const photoPlan = await planProductImageWriteInShop(
      {
        stored: { imageUrl: product.imageUrl, images: product.images },
        images,
        imageUrl,
        clearImageUrl,
      },
      product.shopId
    );
    if (!photoPlan.ok) return apiError("VALIDATION_ERROR", photoPlan.messageFr);

    const updateData: Record<string, unknown> = {
      ...scalarData,
      ...antiGaspiEndOnPriceWrite(product, scalarData.priceCents, new Date()),
      imageUrl: photoPlan.imageUrl,
    };
    if (promoEnd !== undefined) {
      updateData.promoEnd = promoEnd ? new Date(promoEnd) : null;
    }
    if (freshDate !== undefined) {
      updateData.freshDate = freshDate ? new Date(freshDate) : null;
    }
    if (categoryIds) {
      updateData.categories = { set: categoryIds.map((cid: string) => ({ id: cid })) };
    }

    // Photos replaced inside the single product.update below: Prisma runs its nested writes in one
    // transaction, so a failed update keeps the previous photos.
    if (photoPlan.images !== "unchanged") {
      updateData.images = { deleteMany: {}, create: photoPlan.images };
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
        categories: true,
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
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const authId = await getServerUserId();

    if (!authId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }
    const userId = await getBoucherOwnerUserId();

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

    const delUser = await prisma.user.findUnique({
      where: { clerkId: authId },
      select: { id: true, role: true },
    });
    if (
      !isAdmin(delUser?.role) &&
      product.shop.ownerId !== userId &&
      product.shop.ownerId !== delUser?.id
    ) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    // Cascade: images and labels are deleted via onDelete: Cascade
    await prisma.product.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
