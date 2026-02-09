import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

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
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
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
      },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    return apiSuccess(user);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── PATCH /api/users/me ──────────────────────────
// Update notification preferences + phone
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const data = updateMeSchema.parse(body);

    // If enabling SMS or WhatsApp, phone is required
    if ((data.notifSms || data.notifWhatsapp) && data.phone === undefined) {
      // Check if user already has a phone
      const existing = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { phone: true },
      });
      if (!existing?.phone && !data.phone) {
        return apiError("VALIDATION_ERROR", "Numéro de téléphone requis pour les notifications SMS/WhatsApp");
      }
    }

    const updated = await prisma.user.update({
      where: { clerkId: userId },
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
