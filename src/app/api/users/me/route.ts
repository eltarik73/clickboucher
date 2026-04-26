import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerUserId } from "@/lib/auth/server-auth";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateMeSchema = z.object({
  notifSms: z.boolean().optional(),
  notifWhatsapp: z.boolean().optional(),
  phone: z
    .string()
    .regex(/^\+33[0-9]{9}$/, "Numéro au format +33XXXXXXXXX")
    .nullable()
    .optional(),
});

// ── GET /api/users/me ────────────────────────────
// Returns the authenticated user's profile with favorite shops
export async function GET() {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const baseUser = await getOrCreateUser(userId);
    if (!baseUser) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    // Re-fetch with relations
    const user = await prisma.user.findUnique({
      where: { id: baseUser.id },
      include: {
        favoriteShops: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            city: true,
          },
        },
        proAccesses: {
          include: {
            shop: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    // Flatten proAccesses for client
    const data = {
      ...user,
      proAccesses: user?.proAccesses?.map((pa) => ({
        id: pa.id,
        shopId: pa.shop.id,
        shopName: pa.shop.name,
        shopSlug: pa.shop.slug,
        status: pa.status,
        companyName: pa.companyName,
      })) ?? [],
    };

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── PATCH /api/users/me ──────────────────────────
// Update notification preferences + phone
export async function PATCH(req: NextRequest) {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const rl = await checkRateLimit(rateLimits.api, `user-patch:${userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const body = await req.json();
    const data = updateMeSchema.parse(body);

    // Ensure user exists (auto-create if needed)
    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    // If enabling SMS or WhatsApp, phone is required
    if ((data.notifSms || data.notifWhatsapp) && data.phone === undefined) {
      if (!user.phone && !data.phone) {
        return apiError("VALIDATION_ERROR", "Numéro de téléphone requis pour les notifications SMS/WhatsApp");
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.notifSms !== undefined && { notifSms: data.notifSms }),
        ...(data.notifWhatsapp !== undefined && { notifWhatsapp: data.notifWhatsapp }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/users/me ─────────────────────────
// Soft-delete: anonymize personal data + set deletedAt
export async function DELETE() {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const rl = await checkRateLimit(rateLimits.api, `user-delete:${userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    // Check no active orders
    const activeOrders = await prisma.order.count({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY"] },
      },
    });

    if (activeOrders > 0) {
      return apiError(
        "VALIDATION_ERROR",
        "Impossible de supprimer votre compte tant que vous avez des commandes en cours"
      );
    }

    // Soft delete: anonymize data + disconnect favorites in a single transaction
    const deletedSuffix = `_deleted_${Date.now()}`;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          deletedAt: new Date(),
          clerkId: `deleted${deletedSuffix}`,
          firstName: "Compte",
          lastName: "Supprime",
          email: `deleted${deletedSuffix}@klikandgo.app`,
          phone: null,
          companyName: null,
          siret: null,
          sector: null,
          notifSms: false,
          notifWhatsapp: false,
          notifPush: false,
          pushSubscription: Prisma.JsonNull,
          referralCode: null,
          favoriteShops: { set: [] },
        },
      }),
    ]);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
