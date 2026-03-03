// POST /api/offers/validate — Validate an offer code for checkout
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { getServerUserId } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getServerUserId();
    const body = await req.json();
    const { code, orderTotalCents, shopId } = body;

    if (!code || typeof code !== "string") {
      return apiSuccess({ valid: false, error: "Code requis" });
    }

    // 1. Try as Offer code
    const offer = await prisma.offer.findUnique({ where: { code: code.toUpperCase().trim() } });

    if (offer) {
      const now = new Date();

      if (offer.status !== "ACTIVE") {
        return apiSuccess({ valid: false, error: "Cette offre n'est plus active" });
      }
      if (now < offer.startDate || now > offer.endDate) {
        return apiSuccess({ valid: false, error: "Cette offre a expiré" });
      }
      if (offer.maxUses && offer.currentUses >= offer.maxUses) {
        return apiSuccess({ valid: false, error: "Cette offre a atteint son nombre maximum d'utilisations" });
      }

      // Check min order
      const totalEuros = (orderTotalCents || 0) / 100;
      if (offer.minOrder > 0 && totalEuros < offer.minOrder) {
        return apiSuccess({ valid: false, error: `Commande minimum de ${offer.minOrder}€ requise` });
      }

      // Check shop scope: if offer has a shopId, it must match
      if (offer.shopId && shopId && offer.shopId !== shopId) {
        // Check if this shop has accepted a proposal for this offer
        const proposal = await prisma.offerProposal.findFirst({
          where: { offerId: offer.id, shopId, status: "ACCEPTED" },
        });
        if (!proposal) {
          return apiSuccess({ valid: false, error: "Cette offre n'est pas valable dans cette boutique" });
        }
      }

      // Calculate discount
      let discountCents = 0;
      const total = orderTotalCents || 0;

      switch (offer.type) {
        case "PERCENT":
          discountCents = Math.round(total * (offer.discountValue / 100));
          break;
        case "AMOUNT":
          discountCents = Math.round(offer.discountValue * 100);
          break;
        case "FREE_DELIVERY":
          discountCents = 0; // Delivery fees handled separately
          break;
        case "BOGO":
        case "BUNDLE":
          discountCents = Math.round(total * (offer.discountValue / 100));
          break;
      }

      discountCents = Math.min(discountCents, total);

      // Get eligible product IDs if BOGO/BUNDLE
      let eligibleProductIds: string[] = [];
      if (offer.type === "BOGO" || offer.type === "BUNDLE") {
        const eligibleProducts = await prisma.offerProduct.findMany({
          where: { offerId: offer.id, ...(shopId ? { shopId } : {}) },
          select: { productId: true },
        });
        eligibleProductIds = eligibleProducts.map((p) => p.productId);
      }

      // Build label
      const label = offer.type === "PERCENT" ? `-${offer.discountValue}%`
        : offer.type === "AMOUNT" ? `-${offer.discountValue}€`
        : offer.type === "FREE_DELIVERY" ? "Frais offerts"
        : offer.type === "BOGO" ? "1+1 offert"
        : offer.type === "BUNDLE" ? `Pack -${offer.discountValue}%`
        : offer.name;

      return apiSuccess({
        valid: true,
        offerId: offer.id,
        discountCents,
        source: offer.payer === "KLIKGO" ? "PLATFORM" : "SHOP",
        label: `${offer.name} (${label})`,
        type: offer.type,
        ...(eligibleProductIds.length > 0 && { eligibleProductIds }),
      });
    }

    // 2. Try as LoyaltyReward code
    if (userId) {
      const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
      const prismaUserId = dbUser?.id || userId;

      const reward = await prisma.loyaltyReward.findFirst({
        where: {
          code: code.toUpperCase().trim(),
          userId: prismaUserId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (reward) {
        let discountCents = 0;
        const total = orderTotalCents || 0;

        if (reward.rewardType === "FIXED" && reward.rewardCents) {
          discountCents = Math.min(reward.rewardCents, total);
        } else if (reward.rewardType === "PERCENT" && reward.rewardPercent) {
          discountCents = Math.round(total * (reward.rewardPercent / 100));
        }

        return apiSuccess({
          valid: true,
          loyaltyRewardId: reward.id,
          discountCents,
          source: "LOYALTY",
          label: `Fidélité (${reward.rewardType === "FIXED" ? `-${(reward.rewardCents || 0) / 100}€` : `-${reward.rewardPercent}%`})`,
          type: reward.rewardType,
        });
      }
    }

    return apiSuccess({ valid: false, error: "Code invalide ou expiré" });
  } catch (error) {
    return handleApiError(error, "offers/validate/POST");
  }
}
