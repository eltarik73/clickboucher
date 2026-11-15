export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
// Audit sécurité 2026-05-09 : retiré currentUser, utilise resolveUserRole (DB)
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { resolveUserRole } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { planProductImageWriteInShop } from "@/lib/images/write-scope";
import { isAdmin } from "@/lib/roles";
import { publicPriceCents } from "@/lib/pricing/anti-gaspi";
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
        images: { orderBy: { order: "asc" } },
      },
    });
    if (!original) return apiError("NOT_FOUND", "Produit introuvable");

    // Verify ownership (audit sécurité 2026-05-09 : DB lookup)
    const role = await resolveUserRole();
    if (!isAdmin(role) && original.shopId !== authShopId) {
      return apiError("FORBIDDEN", "Non autorise");
    }

    // The copy's photos go through the same write plan as an edit of the source row: same
    // normalisation and mirror, and the source's stored values keep their grandfathered status.
    const photoPlan = await planProductImageWriteInShop(
      { stored: { imageUrl: original.imageUrl, images: original.images }, images: original.images },
      original.shopId
    );
    if (!photoPlan.ok) return apiError("VALIDATION_ERROR", photoPlan.messageFr);

    // Create duplicate
    const duplicate = await prisma.product.create({
      data: {
        name: `${original.name} (copie)`,
        description: original.description,
        imageUrl: photoPlan.imageUrl,
        // The copy is out of anti-gaspi: after an expired one, the original price customers pay.
        priceCents: publicPriceCents(original, new Date()),
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
        labels:
          original.labels.length > 0
            ? {
                create: original.labels.map((l) => ({
                  name: l.name,
                  color: l.color,
                })),
              }
            : undefined,
        images: photoPlan.images === "unchanged" ? undefined : { create: photoPlan.images },
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
