export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { isTestActivated, getTestRole } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";
import { z } from "zod";

const createCategorySchema = z.object({
  shopId: z.string().min(1),
  name: z.string().min(1).max(100),
  emoji: z.string().max(10).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().max(10).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

const deleteCategorySchema = z.object({
  id: z.string().min(1),
});

// ── GET /api/categories?shopId=xxx ──
export async function GET(req: NextRequest) {
  try {
    const shopId = req.nextUrl.searchParams.get("shopId");
    if (!shopId) return apiError("VALIDATION_ERROR", "shopId requis");

    const categories = await prisma.category.findMany({
      where: { shopId },
      orderBy: { order: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return apiSuccess(categories);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/categories ──
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { userId } = authResult;

    const body = await req.json();
    const data = createCategorySchema.parse(body);

    // Verify ownership (admin bypass)
    let role: string | undefined;
    if (isTestActivated()) {
      const testRole = getTestRole();
      role = testRole === "ADMIN" ? "admin" : undefined;
    } else {
      const user = await currentUser();
      role = (user?.publicMetadata as Record<string, string>)?.role;
    }
    if (!isAdmin(role)) {
      const shop = await prisma.shop.findUnique({
        where: { id: data.shopId },
        select: { ownerId: true },
      });
      if (!shop) return apiError("NOT_FOUND", "Boucherie introuvable");
      if (shop.ownerId !== userId) return apiError("FORBIDDEN", "Non autorise");
    }

    // Auto-set order to last
    const maxOrder = await prisma.category.aggregate({
      where: { shopId: data.shopId },
      _max: { order: true },
    });

    const category = await prisma.category.create({
      data: {
        name: data.name,
        emoji: data.emoji ?? null,
        order: data.order ?? (maxOrder._max.order ?? 0) + 1,
        shopId: data.shopId,
      },
    });

    return apiSuccess(category);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── PATCH /api/categories ──
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { userId } = authResult;

    const body = await req.json();
    const data = updateCategorySchema.parse(body);

    // Verify ownership via category -> shop
    const category = await prisma.category.findUnique({
      where: { id: data.id },
      include: { shop: { select: { ownerId: true } } },
    });
    if (!category) return apiError("NOT_FOUND", "Categorie introuvable");

    let role: string | undefined;
    if (isTestActivated()) {
      const testRole = getTestRole();
      role = testRole === "ADMIN" ? "admin" : undefined;
    } else {
      const user = await currentUser();
      role = (user?.publicMetadata as Record<string, string>)?.role;
    }
    if (!isAdmin(role) && category.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Non autorise");
    }

    const updated = await prisma.category.update({
      where: { id: data.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.emoji !== undefined && { emoji: data.emoji }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/categories ──
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { userId } = authResult;

    const body = await req.json();
    const data = deleteCategorySchema.parse(body);

    const category = await prisma.category.findUnique({
      where: { id: data.id },
      include: {
        shop: { select: { ownerId: true } },
        _count: { select: { products: true } },
      },
    });
    if (!category) return apiError("NOT_FOUND", "Categorie introuvable");

    let role: string | undefined;
    if (isTestActivated()) {
      const testRole = getTestRole();
      role = testRole === "ADMIN" ? "admin" : undefined;
    } else {
      const user = await currentUser();
      role = (user?.publicMetadata as Record<string, string>)?.role;
    }
    if (!isAdmin(role) && category.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Non autorise");
    }

    if (category._count.products > 0) {
      return apiError("VALIDATION_ERROR", `Impossible de supprimer : ${category._count.products} produit(s) dans cette categorie`);
    }

    await prisma.category.delete({ where: { id: data.id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
