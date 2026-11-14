// src/lib/offer-badge-label.ts — the short label a public offer puts on a shop card (« -20% »,
// « Frais offerts »…), shared by the home page and GET /api/shops/nearby. Pure.
import type { OfferType } from "@prisma/client";

export interface BadgeOffer {
  shopId: string | null;
  type: OfferType;
  discountValue: number;
  name: string;
}

/** The short label of one offer on a shop card. */
export function offerBadgeLabel(offer: Omit<BadgeOffer, "shopId">): string {
  switch (offer.type) {
    case "FREE_FEES":
      return "Frais offerts";
    case "PERCENT":
      return `-${offer.discountValue}%`;
    case "AMOUNT":
      return `-${offer.discountValue}€`;
    case "BOGO":
      return "1+1 offert";
    case "BUNDLE":
      return "Pack";
    default:
      return offer.name;
  }
}

/** Shop id → label of its first offer in the given order; platform offers (no shop) are skipped. */
export function badgeLabelsByShop(offers: readonly BadgeOffer[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const offer of offers) {
    if (offer.shopId && !labels.has(offer.shopId)) {
      labels.set(offer.shopId, offerBadgeLabel(offer));
    }
  }
  return labels;
}
