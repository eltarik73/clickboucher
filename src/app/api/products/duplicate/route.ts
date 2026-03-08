export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { isTestActivated, getTestRole } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";
import { z } from "zod";

const duplicateSchema = z.object({
  productId: z.string().min(1),
});

// ── POST /api/products/duplicate ──
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId: authShopId } = authResult;

    const body = await req.json();
    const { productId } = duplicateSchema.parse(body);

    // Fetch original product with labels
    const original = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        shop: { select: { ownerId: true } },
        categories: { select: { id: true } },
        labels: true,
        images: true,
      },
    });
    if (!original) return apiError("NOT_FOUND", "Produit introuvable");

    // Verify ownership
    let role: string | undefined;
    if (isTestActivated()) {
      const testRole = getTestRole();
      role = testRole === "ADMIN" ? "admin" : undefined;
    } else {
      const user = await currentUser();
      role = (user?.publicMetadata as Record<string, string>)?.role;
    }
    if (!isAdmin(role) && original.shopId !== authShopId) {
      return apiError("FORBIDDEN", "Non autorise");
    }

    // Create duplicate
    const duplicate = await prisma.product.create({
      data: {
        name: `${original.name} (copie)`,
        description: original.description,
        imageUrl: original.imageUrl,
        priceCents: original.priceCents,
        proPriceCents: original.proPriceCents,
        unit: original.unit,
        inStock: false, // Start out of stock
        stockQty: original.stockQty,
        minWeightG: original.minWeightG,
        weightStepG: original.weightStepG,
        maxWeightG: original.maxWeightG,
        displayOrder: original.displayOrder + 1,
        featured: false,
        popular: false,
        categories: { connect: original.categories.map((c) => ({ id: c.id })) },
        shopId: original.shopId,
        tags: original.tags,
        origin: original.origin,
        halalOrg: original.halalOrg,
        race: original.race,
        freshness: original.freshness,
        customerNote: original.customerNote,
        unitLabel: original.unitLabel,
        vatRate: original.vatRate,
        sliceOptions: original.sliceOptions as object | undefined,
        isActive: false, // Start inactive
        labels: original.labels.length > 0
          ? {
              create: original.labels.map((l) => ({
                name: l.name,
                color: l.color,
              })),
            }
          : undefined,
        images: original.images.length > 0
          ? {
              create: original.images.map((img) => ({
                url: img.url,
                alt: img.alt,
                order: img.order,
                isPrimary: img.isPrimary,
              })),
            }
          : undefined,
      },
      include: {
        categories: true,
        labels: true,
        images: true,
      },
    });

    return apiSuccess(duplicate);
  } catch (error) {
    return handleApiError(error);
  }
}
