// src/app/api/users/me/export/route.ts
// RGPD article 20 — Droit à la portabilité des données.
// Audit sécurité CTO #2 2026-05-09 : endpoint manquant créé pour conformité.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api/errors";
import { getServerUserId } from "@/lib/auth/server-auth";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/me/export
 * Export JSON des données personnelles : profil, commandes (+items),
 * notifications, avis, recurring orders, ProAccess, fidélité.
 *
 * Format application/json téléchargeable. Rate limit : 5/min (helper api).
 */
export async function GET(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Connexion requise");

    const rl = await checkRateLimit(rateLimits.api, `export:${clerkId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de demandes. Réessayez plus tard.");
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        notifEmail: true,
        notifSms: true,
        notifWhatsapp: true,
        notifPush: true,
        latitude: true,
        longitude: true,
        city: true,
        address: true,
        language: true,
        companyName: true,
        siret: true,
        sector: true,
        proStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser) return apiError("NOT_FOUND", "Compte introuvable");

    const [orders, notifications, reviews, recurringOrders, proAccess] = await Promise.all([
      prisma.order.findMany({
        where: { userId: dbUser.id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalCents: true,
          serviceFeeCents: true,
          createdAt: true,
          pickupSlotStart: true,
          pickupSlotEnd: true,
          shop: { select: { name: true, city: true } },
          items: {
            select: {
              name: true,
              quantity: true,
              unit: true,
              priceCents: true,
              totalCents: true,
              weightGrams: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { userId: dbUser.id },
        select: {
          type: true,
          message: true,
          channel: true,
          read: true,
          createdAt: true,
        },
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
      prisma.review
        .findMany({
          where: { userId: dbUser.id },
          select: {
            rating: true,
            comment: true,
            createdAt: true,
            shop: { select: { name: true } },
          },
        })
        .catch(() => []),
      prisma.recurringOrder
        .findMany({
          where: { userId: dbUser.id },
          select: {
            id: true,
            frequency: true,
            nextRunAt: true,
            active: true,
            createdAt: true,
            shop: { select: { name: true } },
          },
        })
        .catch(() => []),
      prisma.proAccess
        .findFirst({
          where: { userId: dbUser.id },
          select: { status: true, siret: true, companyName: true, requestedAt: true },
        })
        .catch(() => null),
    ]);

    const exportPayload = {
      _metadata: {
        exportedAt: new Date().toISOString(),
        format: "klikgo-rgpd-export-v1",
        notice:
          "Export RGPD article 20 (portabilité). Conservez ce fichier en lieu sûr — il contient des données personnelles.",
      },
      profile: dbUser,
      orders,
      notifications,
      reviews,
      recurringOrders,
      proAccess,
    };

    logger.info("[users/me/export] generated", {
      clerkId,
      ordersCount: orders.length,
      notificationsCount: notifications.length,
    });

    const filename = `klikgo-export-${dbUser.id}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return handleApiError(error, "users/me/export");
  }
}
