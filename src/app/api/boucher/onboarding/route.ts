// GET /api/boucher/onboarding — Return onboarding progression
// PATCH /api/boucher/onboarding — Mark step or complete
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const patchOnboardingSchema = z.object({
  complete: z.boolean().optional(),
  setVisible: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

type Step = {
  key: string;
  label: string;
  emoji: string;
  weight: number;
  completed: boolean;
  href: string;
};

export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { _count: { select: { products: true } } },
    });

    if (!shop) return apiError("NOT_FOUND", "Aucune boutique trouvée");

    const openingHours = shop.openingHours as Record<string, unknown> | null;
    const pickupSlots = shop.pickupSlots as unknown[];

    const steps: Step[] = [
      {
        key: "account",
        label: "Compte créé",
        emoji: "✅",
        weight: 10,
        completed: true,
        href: "#",
      },
      {
        key: "shop_photo",
        label: "Photo de votre boutique",
        emoji: "📷",
        weight: 10,
        completed: !!shop.imageUrl,
        href: "/boucher/parametres",
      },
      {
        key: "owner_photo",
        label: "Votre photo (confiance client)",
        emoji: "📷",
        weight: 10,
        completed: !!shop.ownerPhotoUrl,
        href: "/boucher/parametres",
      },
      {
        key: "opening_hours",
        label: "Horaires d'ouverture",
        emoji: "🕐",
        weight: 15,
        completed: !!openingHours && Object.keys(openingHours).length > 0,
        href: "/boucher/parametres",
      },
      {
        key: "pickup_slots",
        label: "Créneaux de retrait",
        emoji: "🕐",
        weight: 15,
        completed: Array.isArray(pickupSlots) && pickupSlots.length > 0,
        href: "/boucher/parametres",
      },
      {
        key: "products",
        label: "Ajouter au moins 5 produits",
        emoji: "🥩",
        weight: 20,
        completed: shop._count.products >= 5,
        href: "/boucher/produits",
      },
      {
        key: "halal",
        label: "Certification halal",
        emoji: "☪️",
        weight: 10,
        completed: !!shop.halalCertUrl,
        href: "/boucher/parametres",
      },
      {
        key: "payment",
        label: "Configuration paiement",
        emoji: "💳",
        weight: 10,
        completed: shop.acceptOnline || shop.acceptOnPickup,
        href: "/boucher/parametres",
      },
    ];

    const progress = steps.reduce((sum, s) => sum + (s.completed ? s.weight : 0), 0);

    return apiSuccess({
      steps,
      progress,
      onboardingCompleted: shop.onboardingCompleted,
      visible: shop.visible,
    });
  } catch (error) {
    return handleApiError(error, "boucher/onboarding");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const body = await req.json();
    const { complete, setVisible } = patchOnboardingSchema.parse(body);

    if (setVisible) {
      await prisma.shop.update({
        where: { id: shopId },
        data: { visible: true },
      });
      return apiSuccess({ visible: true });
    }

    if (complete) {
      await prisma.shop.update({
        where: { id: shopId },
        data: { onboardingCompleted: true },
      });
    }

    return apiSuccess({ onboardingCompleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/onboarding/complete");
  }
}
