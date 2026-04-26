export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { updateShopSchema } from "@/lib/validators";
import { apiSuccess, apiCached, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";

// ── GET /api/shops/[id] ────────────────────────
// Public — shop detail with categories & products
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const shop = await prisma.shop.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { order: "asc" },
        },
        products: {
          where: { inStock: true },
          include: { categories: true },
          orderBy: { name: "asc" },
          take: 100,
        },
        _count: { select: { orders: true, products: true } },
      },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    return apiCached({
      ...shop,
      effectivePrepTime: shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0),
    }, 60);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── PATCH /api/shops/[id] ──────────────────────
// Boucher (owner) or Admin — update shop info
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

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

      if (shop.ownerId !== userId && shop.ownerId !== dbUser?.id) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
    }

    const body = await req.json();
    const data = updateShopSchema.parse(body);

    // Photos are webmaster-only: strip imageUrl/bannerUrl for non-admins
    if (!isAdmin(role)) {
      delete (data as Record<string, unknown>).imageUrl;
      delete (data as Record<string, unknown>).bannerUrl;
    }

    const updated = await prisma.shop.update({
      where: { id },
      data,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/shops/[id] ─────────────────────
// Admin only — delete a shop (cascade: categories, products)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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
