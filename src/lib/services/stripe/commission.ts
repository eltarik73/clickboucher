// src/lib/services/stripe/commission.ts
//
// Commission engine pour la marketplace Klik&Go.
//
// Modèle :
// - 4 paliers Bronze/Argent/Or/Platine selon CA mensuel HT du shop.
// - Plancher absolu : 5%.
// - Bonus Early Adopter : -2 pts pendant 3 mois (50 premiers bouchers).
// - Frais service : 0,99€ fixe par commande (perçu en plus du panier).
// - Markup commission : le boucher saisit boutiquePriceCents (prix magasin),
//   choisit un % de markup (0/30/50/80/100). Le système calcule priceCents
//   (prix online affiché client) avec gross-up : online = boutique / (1 - rate * markup%).
// - Arrondi DOWN au 0,10€ près.
//
// Tous les montants sont en CENTS (entiers). Retours arrondis au cent près.

export type ShopTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export const TIER_THRESHOLDS = {
  BRONZE: { min: 0, max: 200_000, rate: 0.08 }, // 0–2 000 € HT/mois → 8%
  SILVER: { min: 200_000, max: 500_000, rate: 0.07 }, // 2 000–5 000 € → 7%
  GOLD: { min: 500_000, max: 1_000_000, rate: 0.06 }, // 5 000–10 000 € → 6%
  PLATINUM: { min: 1_000_000, max: Infinity, rate: 0.05 }, // > 10 000 € → 5%
} as const;

export const COMMISSION_FLOOR = 0.05; // 5% — plancher absolu (jamais en dessous)
export const SERVICE_FEE_CENTS = 99; // 0,99€ frais service Klik&Go par commande
export const EARLY_ADOPTER_DISCOUNT = 0.02; // -2 pts pour les 50 premiers bouchers (3 mois)

/**
 * Markups proposés au boucher dans l'UI.
 * 0% = boucher absorbe la commission (online = boutique).
 * 80% recommandé = bon compromis lisibilité/marge.
 */
export const ALLOWED_MARKUP_PERCENTS = [0, 30, 50, 80, 100] as const;
export type MarkupPercent = (typeof ALLOWED_MARKUP_PERCENTS)[number];

/**
 * Détermine le palier d'un shop d'après son CA mensuel HT (en cents).
 * Appelé par le cron mensuel (à venir) qui recalcule le tier après clôture
 * du mois précédent.
 */
export function computeTier(monthlyGmvCents: number): ShopTier {
  if (monthlyGmvCents >= TIER_THRESHOLDS.PLATINUM.min) return "PLATINUM";
  if (monthlyGmvCents >= TIER_THRESHOLDS.GOLD.min) return "GOLD";
  if (monthlyGmvCents >= TIER_THRESHOLDS.SILVER.min) return "SILVER";
  return "BRONZE";
}

/**
 * Taux de commission effectif appliqué à une commande.
 * = taux du palier - bonus early adopter (si applicable)
 * - jamais en dessous du plancher (5%).
 */
export function getEffectiveCommissionRate(shop: {
  tier: ShopTier;
  earlyAdopterUntil: Date | null;
}): number {
  const baseRate = TIER_THRESHOLDS[shop.tier].rate;
  const isEarlyAdopter =
    shop.earlyAdopterUntil !== null && shop.earlyAdopterUntil > new Date();
  const rateAfterDiscount = isEarlyAdopter
    ? baseRate - EARLY_ADOPTER_DISCOUNT
    : baseRate;
  return Math.max(COMMISSION_FLOOR, rateAfterDiscount);
}

/**
 * Calcule le prix online affiché client à partir du prix boutique + markup.
 *
 * Cas markup=0 → boucher absorbe la commission, pas de gross-up.
 * Cas markup>0 → gross-up : online = boutique / (1 - rate * markup%)
 *
 * Ex : boutique=14€, rate=8%, markup=80% → online = 14 / (1 - 0.064) = 14,96€
 *      arrondi DOWN au 0,10€ → 14,90€
 *
 * @param boutiquePriceCents - Prix magasin physique (entiers)
 * @param effectiveCommissionRate - Taux commission effectif (0.05 à 0.08)
 * @param markupPercent - 0 / 30 / 50 / 80 / 100 (%)
 * @param roundingEnabled - Si true, arrondi DOWN au 0,10€ (défaut). Sinon arrondi au cent.
 * @returns Prix online en cents
 */
export function computeOnlinePriceCents(
  boutiquePriceCents: number,
  effectiveCommissionRate: number,
  markupPercent: number,
  roundingEnabled: boolean = true,
): number {
  if (boutiquePriceCents <= 0) return 0;

  // Si markup 0% → le boucher absorbe la commission (online = boutique).
  if (markupPercent === 0) {
    return boutiquePriceCents;
  }

  // Gross-up : online = boutique / (1 - rate * markup%)
  // markupPercent / 100 transforme 80 → 0.80
  const effectiveMarkup = effectiveCommissionRate * (markupPercent / 100);

  // Sécurité : ne jamais avoir un dénominateur ≤ 0
  if (effectiveMarkup >= 1) {
    return boutiquePriceCents;
  }

  const onlinePriceRaw = boutiquePriceCents / (1 - effectiveMarkup);

  if (!roundingEnabled) {
    return Math.round(onlinePriceRaw);
  }

  // Arrondi DOWN au 0,10€ près = floor(price/10) * 10
  // Ex: 1456 cts → floor(145.6) * 10 = 1450 cts (14,50€)
  return Math.floor(onlinePriceRaw / 10) * 10;
}

/**
 * Commission Klik&Go en cents pour une commande.
 * Calculée sur le subtotal du panier (sans frais service, sans remise).
 *
 * @param orderSubtotalCents - Total panier en cents
 * @param effectiveCommissionRate - Taux commission effectif (0.05 à 0.08)
 */
export function computeOrderCommission(
  orderSubtotalCents: number,
  effectiveCommissionRate: number,
): number {
  if (orderSubtotalCents <= 0) return 0;
  return Math.round(orderSubtotalCents * effectiveCommissionRate);
}

/**
 * Calcule le breakdown complet d'une commande pour Stripe Connect.
 *
 * Flow :
 * - Le client paie : subtotal + frais service (= totalToPay)
 * - Stripe transfère au boucher : subtotal - commission %
 * - Klik&Go conserve : commission % + frais service (- frais Stripe absorbés)
 *
 * platformFeeCents (= application_fee_amount Stripe) = commission + service fee
 */
export function computeOrderFees(input: {
  orderSubtotalCents: number;
  effectiveCommissionRate: number;
}): {
  subtotalCents: number;
  commissionCents: number;
  serviceFeeCents: number;
  platformFeeCents: number;
  shopPayoutCents: number;
  totalToPayCents: number;
} {
  const subtotal = input.orderSubtotalCents;
  const commission = computeOrderCommission(subtotal, input.effectiveCommissionRate);
  const platformFee = commission + SERVICE_FEE_CENTS;
  const shopPayout = subtotal - commission;
  const totalToPay = subtotal + SERVICE_FEE_CENTS;

  return {
    subtotalCents: subtotal,
    commissionCents: commission,
    serviceFeeCents: SERVICE_FEE_CENTS,
    platformFeeCents: platformFee,
    shopPayoutCents: shopPayout,
    totalToPayCents: totalToPay,
  };
}

/**
 * Estime les frais Stripe France (1.4% + 0.25€ pour cartes EU).
 * Reporting interne uniquement — Stripe les déduit automatiquement de la part Klik&Go.
 */
export function estimateStripeFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * 0.014) + 25;
}
