// src/lib/marketing/validate-code.ts — Promo code validation at checkout
import prisma from "@/lib/prisma";
import { getClientSegment, isSegmentEligible } from "./segments";
import type { Offer, OfferProduct } from "@prisma/client";

type OfferWithProducts = Offer & { eligibleProducts: OfferProduct[] };

type ValidResult = {
  valid: true;
  offer: Offer;
  discount: number;
  freeProductId?: string;
};
type InvalidResult = { valid: false; error: string };

export async function validatePromoCode(params: {
  code: string;
  userId: string;
  cartTotal: number; // in euros
  cartProductIds: string[];
}): Promise<ValidResult | InvalidResult> {
  // 1. Code exists?
  const offer = (await prisma.offer.findUnique({
    where: { code: params.code.toUpperCase().trim() },
    include: { eligibleProducts: true },
  })) as OfferWithProducts | null;

  if (!offer) return { valid: false, error: "Code promo invalide" };

  // 2. Active?
  if (offer.status !== "ACTIVE")
    return { valid: false, error: "Ce code n'est plus valide" };

  // 3. Dates?
  const now = new Date();
  if (now < offer.startDate || now > offer.endDate)
    return { valid: false, error: "Ce code a expiré" };

  // 4. Max uses?
  if (offer.maxUses && offer.currentUses >= offer.maxUses)
    return { valid: false, error: "Ce code a atteint sa limite d'utilisation" };

  // 5. Segment eligible?
  const segment = await getClientSegment(params.userId);
  if (!isSegmentEligible(segment, offer.audience))
    return { valid: false, error: "Ce code n'est pas disponible pour votre compte" };

  // 6. Min order?
  if (params.cartTotal < offer.minOrder)
    return {
      valid: false,
      error: `Commande minimum de ${offer.minOrder}€ requise`,
    };

  // 7. Already used by this client?
  const alreadyUsed = await prisma.order.findFirst({
    where: {
      userId: params.userId,
      offerId: offer.id,
      status: { notIn: ["CANCELLED", "DENIED"] },
    },
  });
  if (alreadyUsed)
    return { valid: false, error: "Vous avez déjà utilisé ce code" };

  // 8. Calculate discount
  let discount = 0;
  let freeProductId: string | undefined;

  switch (offer.type) {
    case "PERCENT":
      discount = (params.cartTotal * offer.discountValue) / 100;
      break;
    case "AMOUNT":
      discount = Math.min(offer.discountValue, params.cartTotal);
      break;
    case "FREE_DELIVERY":
      discount = 0.99;
      break;
    case "BOGO": {
      const eligibleIds = offer.eligibleProducts.map((ep) => ep.productId);
      const matchingProduct = params.cartProductIds.find((id) =>
        eligibleIds.includes(id)
      );
      if (!matchingProduct)
        return {
          valid: false,
          error: "Ajoutez un produit éligible à votre panier",
        };
      freeProductId = matchingProduct;
      const product = await prisma.product.findUnique({
        where: { id: matchingProduct },
        select: { priceCents: true },
      });
      discount = product ? product.priceCents / 100 : 0;
      break;
    }
    case "BUNDLE":
      discount = offer.discountValue;
      break;
  }

  return { valid: true, offer, discount, freeProductId };
}
