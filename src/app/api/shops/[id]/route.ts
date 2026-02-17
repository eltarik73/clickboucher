export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { updateShopSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

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
          include: { category: true },
          orderBy: { name: "asc" },
        },
        _count: { select: { orders: true, products: true } },
      },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

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
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Check ownership or admin
    if (role !== "admin") {
      const shop = await prisma.shop.findUnique({
        where: { id },
        select: { ownerId: true },
      });

      if (!shop) {
        return apiError("NOT_FOUND", "Boucherie introuvable");
      }

      if (shop.ownerId !== userId) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
    }

    const body = await req.json();
    const data = updateShopSchema.parse(body);

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
    const { sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!sessionClaims) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }
    if (role !== "admin") {
      return apiError("FORBIDDEN", "Réservé aux administrateurs");
    }

    await prisma.shop.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
