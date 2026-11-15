export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import type { z } from "zod";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { ownerShopUpdateSchema, updateShopSchema } from "@/lib/validators";
import { readJsonBody } from "@/lib/api/request-body";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { shopImageRefusal } from "@/lib/images/write-scope";
import { isAdmin } from "@/lib/roles";
import { publicProductSelect, publicShopSelect } from "@/lib/public-projections";
import { isShopPageReachable, shopPublicationSelect } from "@/lib/shop-publication";

// ── GET /api/shops/[id] ────────────────────────
// Public — shop detail with categories & products, allow-listed fields only
// (src/lib/public-projections.ts). The owner reads his own shop through /api/shops/my-shop.
// A shop whose page is not reachable (suspended, never validated, unpublished) does not exist here.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const found = await prisma.shop.findUnique({
      where: { id },
      select: {
        ...publicShopSelect,
        ...shopPublicationSelect,
        categories: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, emoji: true, order: true, imageUrl: true },
        },
        products: {
          where: { inStock: true },
          select: publicProductSelect,
          orderBy: { name: "asc" },
          take: 100,
        },
        _count: { select: { products: true } },
      },
    });

    if (!found || !isShopPageReachable(found)) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }
    // The publication facts decide reachability; they are not part of the public projection.
    const { visible, suspendedAt, vacationMode, ...shop } = found;

    // Never stored by a shared cache: a suspension or an unpublication must hide the shop at once,
    // and no page of the app reads this route (each request costs one query).
    return apiSuccess({
      ...shop,
      effectivePrepTime: shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ── PATCH /api/shops/[id] ──────────────────────
// Boucher (owner) or Admin — update shop info
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Test mode bypass — when a tester is impersonating BOUCHER/ADMIN, the
    // synthetic clerkId has no DB user. getAuthenticatedBoucher resolves the
    // first-shop / ownership consistently across the codebase, so reuse it
    // here. (Outside test mode the function still checks Clerk auth.)
    const { getAuthenticatedBoucher } = await import("@/lib/boucher-auth");
    const boucherAuth = await getAuthenticatedBoucher();

    // Check role via DB lookup (not Clerk publicMetadata)
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    const role = dbUser?.role;

    // Check ownership or admin/webmaster
    if (!isAdmin(role)) {
      const shop = await prisma.shop.findUnique({
        where: { id },
        select: { ownerId: true },
      });

      if (!shop) {
        return apiError("NOT_FOUND", "Boucherie introuvable");
      }

      const isOwner =
        shop.ownerId === userId ||
        shop.ownerId === dbUser?.id ||
        // Test mode: the test boucher owns whatever shop getAuthenticatedBoucher resolved.
        (!boucherAuth.error && boucherAuth.shopId === id);

      if (!isOwner) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
    }

    const body = await readJsonBody(req);
    // Both schemas are strict: a platform-owned key (commission, publication, photos for an owner)
    // answers 400 and nothing is written. The owner's fields are a subset of the admin's.
    const data: z.infer<typeof updateShopSchema> = isAdmin(role)
      ? updateShopSchema.parse(body)
      : ownerShopUpdateSchema.parse(body);

    const photoRefusal = await shopImageRefusal(data, id);
    if (photoRefusal) {
      const { field, messageFr } = photoRefusal;
      return apiError("VALIDATION_ERROR", messageFr, { [field]: [messageFr] });
    }

    // Capture pricing-relevant fields BEFORE the update so we can detect a change.
    const pricingFieldsChanged =
      data.commissionMarkupPercent !== undefined || data.priceRoundingEnabled !== undefined;

    const updated = await prisma.shop.update({
      where: { id },
      data,
    });

    // When the shop's markup or rounding flag changes, recompute every product's
    // online priceCents from its boutiquePriceCents so the catalog stays consistent.
    // Without this, only the next product the boucher edits picks up the new markup.
    if (pricingFieldsChanged) {
      const { computeOnlinePriceCents, getEffectiveCommissionRate } =
        await import("@/lib/services/stripe/commission");
      const effRate = getEffectiveCommissionRate({
        tier: updated.tier,
        earlyAdopterUntil: updated.earlyAdopterUntil,
      });
      // Stream product updates in batches; only touch products with a real boutique price.
      const products = await prisma.product.findMany({
        where: { shopId: id, boutiquePriceCents: { not: null, gt: 0 } },
        select: { id: true, boutiquePriceCents: true, priceCents: true },
      });
      const updates = products
        .map((p) => ({
          id: p.id,
          newPrice: computeOnlinePriceCents(
            p.boutiquePriceCents ?? 0,
            effRate,
            updated.commissionMarkupPercent,
            updated.priceRoundingEnabled
          ),
        }))
        .filter((u) => u.newPrice !== products.find((p) => p.id === u.id)!.priceCents);
      if (updates.length > 0) {
        await prisma.$transaction(
          updates.map((u) =>
            prisma.product.update({ where: { id: u.id }, data: { priceCents: u.newPrice } })
          )
        );
      }
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/shops/[id] ─────────────────────
// Admin only — delete a shop (cascade: categories, products)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const delDbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (!isAdmin(delDbUser?.role)) {
      return apiError("FORBIDDEN", "Réservé aux administrateurs");
    }

    await prisma.shop.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
