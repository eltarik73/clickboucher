// src/lib/services/orders/discount.ts — which discount a promo code gives on an order.
//
// Reads only: the use is consumed later, inside the order transaction, by discount-ledger.ts,
// which repeats the conditions the database can guarantee (window, uses left, once per customer).
// The amounts come from src/lib/pricing/discount.ts. A code is first looked up as an offer, then
// as a loyalty reward. Every refusal carries the French message shown to the customer.
import type { Offer } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getClientSegment, isSegmentEligible } from "@/lib/marketing/segments";
import { DISCOUNT_RELEASING_STATUSES } from "@/lib/order-state-machine";
import {
  loyaltyRewardDiscount,
  offerAppliesToShop,
  offerDiscount,
  offerWindow,
  type DiscountAmount,
  type DiscountRejection,
  type OfferWindow,
} from "@/lib/pricing/discount";
import { formatPrice } from "@/lib/utils";
import type { DiscountUnavailableReason } from "./discount-ledger";

export type DiscountSource = "SHOP" | "PLATFORM" | "LOYALTY";

export interface ResolvedDiscount {
  code: string;
  label: string;
  discountCents: number;
  waivesServiceFee: boolean;
  source: DiscountSource;
  /** Internal references, written on the order; never sent to the browser. */
  offerId: string | null;
  loyaltyRewardId: string | null;
}

export type DiscountRefusal = { ok: false; reason: string; message: string };
export type DiscountResolution = { ok: true; discount: ResolvedDiscount } | DiscountRefusal;

export interface DiscountRequest {
  code: string;
  shopId: string;
  /** null = anonymous visitor. */
  customer: { id: string; isGuest: boolean } | null;
  subtotalCents: number;
  serviceFeeCents: number;
  now: Date;
}

function refuse(reason: string, message: string): DiscountRefusal {
  return { ok: false, reason, message };
}

const WINDOW_MESSAGES: Record<Exclude<OfferWindow, "OK">, string> = {
  NOT_ACTIVE: "Ce code n'est plus valide",
  NOT_STARTED: "Ce code n'est pas encore valable",
  EXPIRED: "Ce code a expiré",
  EXHAUSTED: "Ce code a atteint sa limite d'utilisation",
};

function amountRefusal(result: Extract<DiscountAmount, { ok: false }>): DiscountRefusal {
  const messages: Record<DiscountRejection, string> = {
    MIN_ORDER_NOT_REACHED: `Ce code demande une commande minimum de ${formatPrice(result.minOrderCents ?? 0)}`,
    UNSUPPORTED_OFFER_TYPE: "Cette offre n'est pas encore utilisable en ligne",
    NO_SERVICE_FEE_TO_WAIVE:
      "Cette commande n'a pas de frais de service : ce code ne s'applique pas",
    INVALID_OFFER_VALUE: "Ce code ne peut pas être utilisé",
  };
  return refuse(result.reason, messages[result.reason]);
}

const LEDGER_MESSAGES: Record<DiscountUnavailableReason, string> = {
  OFFER_NOT_REDEEMABLE: "Ce code promo n'est plus disponible",
  OFFER_ALREADY_USED: "Vous avez déjà utilisé ce code",
  REWARD_UNAVAILABLE: "Cette récompense fidélité n'est plus disponible",
};

/** French message for a use refused inside the order transaction. */
export function discountUnavailableMessage(reason: DiscountUnavailableReason): string {
  return LEDGER_MESSAGES[reason];
}

async function hasAcceptedProposal(offer: Offer, shopId: string): Promise<boolean> {
  if (offer.shopId !== null || offer.payer !== "BUTCHER") return false;
  const proposal = await prisma.offerProposal.findUnique({
    where: { offerId_shopId: { offerId: offer.id, shopId } },
    select: { status: true },
  });
  return proposal?.status === "ACCEPTED";
}

async function resolveOffer(
  offer: Offer,
  request: DiscountRequest,
  customerId: string
): Promise<DiscountResolution> {
  const window = offerWindow(offer, request.now);
  if (window !== "OK") return refuse(window, WINDOW_MESSAGES[window]);

  const accepted = await hasAcceptedProposal(offer, request.shopId);
  if (!offerAppliesToShop(offer, request.shopId, accepted)) {
    return refuse("NOT_APPLICABLE_TO_SHOP", "Ce code n'est pas valable dans cette boucherie");
  }

  const segment = await getClientSegment(customerId);
  if (!isSegmentEligible(segment, offer.audience)) {
    return refuse("AUDIENCE_NOT_ELIGIBLE", "Ce code n'est pas disponible pour votre compte");
  }

  const amount = offerDiscount(offer, {
    subtotalCents: request.subtotalCents,
    serviceFeeCents: request.serviceFeeCents,
  });
  if (!amount.ok) return amountRefusal(amount);

  const previousUse = await prisma.order.findFirst({
    where: {
      userId: customerId,
      offerId: offer.id,
      status: { notIn: [...DISCOUNT_RELEASING_STATUSES] },
    },
    select: { id: true },
  });
  if (previousUse) return refuse("OFFER_ALREADY_USED", LEDGER_MESSAGES.OFFER_ALREADY_USED);

  return {
    ok: true,
    discount: {
      code: offer.code,
      label: offer.name,
      discountCents: amount.discountCents,
      waivesServiceFee: amount.waivesServiceFee,
      source: offer.shopId === null ? "PLATFORM" : "SHOP",
      offerId: offer.id,
      loyaltyRewardId: null,
    },
  };
}

function rewardLabel(reward: {
  rewardType: string;
  rewardCents: number | null;
  rewardPercent: number | null;
}): string {
  return reward.rewardType === "PERCENT"
    ? `Fidélité -${reward.rewardPercent} %`
    : `Fidélité -${formatPrice(reward.rewardCents ?? 0)}`;
}

async function resolveLoyaltyReward(
  request: DiscountRequest,
  code: string,
  customerId: string
): Promise<DiscountResolution> {
  const reward = await prisma.loyaltyReward.findUnique({ where: { code } });
  // Someone else's reward reads as an unknown code: a code never reveals that it exists.
  if (reward === null || reward.userId !== customerId) {
    return refuse("UNKNOWN_CODE", "Code promo invalide");
  }
  if (reward.usedAt !== null)
    return refuse("REWARD_USED", "Cette récompense fidélité a déjà été utilisée");
  if (reward.expiresAt <= request.now)
    return refuse("REWARD_EXPIRED", "Cette récompense fidélité a expiré");

  const amount = loyaltyRewardDiscount(reward, request.subtotalCents);
  if (!amount.ok) return amountRefusal(amount);

  return {
    ok: true,
    discount: {
      code: reward.code,
      label: rewardLabel(reward),
      discountCents: amount.discountCents,
      waivesServiceFee: amount.waivesServiceFee,
      source: "LOYALTY",
      offerId: null,
      loyaltyRewardId: reward.id,
    },
  };
}

/**
 * The discount a code gives on this basket, or why it is refused. A promo code needs a signed-in,
 * non-guest customer: audiences and once-per-customer rules need an identity.
 */
export async function resolveDiscount(request: DiscountRequest): Promise<DiscountResolution> {
  const { customer } = request;
  if (customer === null || customer.isGuest) {
    return refuse("LOGIN_REQUIRED", "Connectez-vous pour utiliser un code promo");
  }
  const code = request.code.trim().toUpperCase();
  const offer = await prisma.offer.findUnique({ where: { code } });
  if (offer !== null) return resolveOffer(offer, request, customer.id);
  return resolveLoyaltyReward(request, code, customer.id);
}
