// GET /api/boucher/onboarding — Return onboarding progression and where the shop's publication is
// PATCH /api/boucher/onboarding — Mark the checklist complete (the butcher's own flag)
//
// Publishing is not the butcher's to do: only the admin lists a shop
// (src/lib/services/shops/moderation.ts). onboardingCompleted is the checklist flag, not a
// validation.
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { shopSuspension } from "@/lib/shop-status";
import {
  SHOP_SUSPENDED_OWNER_MESSAGE,
  shopPublication,
  shopPublicationSelect,
} from "@/lib/shop-publication";
import { z } from "zod";

const patchOnboardingSchema = z
  .object({ complete: z.boolean().optional() })
  .strict({ message: "Ce champ ne peut pas être modifié ici" });

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
      select: {
        ...shopPublicationSelect,
        imageUrl: true,
        ownerPhotoUrl: true,
        openingHours: true,
        pickupSlots: true,
        halalCertUrl: true,
        acceptOnline: true,
        acceptOnPickup: true,
        onboardingCompleted: true,
        _count: { select: { products: true } },
      },
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
      publication: shopPublication(shop),
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

    const { complete } = patchOnboardingSchema.parse(await readJsonBody(req));

    if (await shopSuspension(shopId)) return apiError("FORBIDDEN", SHOP_SUSPENDED_OWNER_MESSAGE);

    const select = { onboardingCompleted: true } as const;
    const shop = complete
      ? await prisma.shop.update({
          where: { id: shopId },
          data: { onboardingCompleted: true },
          select,
        })
      : await prisma.shop.findUnique({ where: { id: shopId }, select });
    if (!shop) return apiError("NOT_FOUND", "Aucune boutique trouvée");

    return apiSuccess({ onboardingCompleted: shop.onboardingCompleted });
  } catch (error) {
    return handleApiError(error, "boucher/onboarding/complete");
  }
}
