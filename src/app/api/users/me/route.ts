import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
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
    const { userId } = await auth();
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
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

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
