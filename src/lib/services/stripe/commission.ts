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

// ⚠️ TVA viande France = 5,5% (taux réduit produits alimentaires).
// La commission Klik&Go DOIT être calculée sur le HT et JAMAIS sur le TTC.
// Sinon Klik&Go prélève une part de la TVA collectée par le boucher → erreur fiscale grave
// (TVA collectée ≠ TVA déclarée à l'URSSAF/DGFiP → redressement boucher).
// Voir audit Phase 1 — issue I4. Référence : BOI-TVA-LIQ-30-10.
export const VAT_RATE_FOOD = 0.055; // 5,5% TVA viande (taux réduit alimentaire FR)

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
 *
 * Accepte `number` ou `bigint` — le champ Prisma est BigInt (audit C4)
 * mais la comparaison reste possible via cast `Number()` pour les valeurs
 * < Number.MAX_SAFE_INTEGER (2^53).
 */
export function computeTier(monthlyGmvCents: number | bigint): ShopTier {
  // Conversion safe : les seuils tier ne dépassent jamais Number.MAX_SAFE_INTEGER
  const gmv = typeof monthlyGmvCents === "bigint" ? Number(monthlyGmvCents) : monthlyGmvCents;
  if (gmv >= TIER_THRESHOLDS.PLATINUM.min) return "PLATINUM";
  if (gmv >= TIER_THRESHOLDS.GOLD.min) return "GOLD";
  if (gmv >= TIER_THRESHOLDS.SILVER.min) return "SILVER";
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
 * Convertit un montant TTC (panier client viande) en HT.
 *
 * La viande = TVA 5,5% (taux réduit alimentaire FR).
 * HT = TTC / (1 + 0,055)
 *
 * ⚠️ Cette conversion est OBLIGATOIRE avant de calculer la commission Klik&Go.
 * Voir computeOrderCommission (audit Phase 1 — issue I4).
 */
export function ttcToHtCents(ttcCents: number): number {
  if (ttcCents <= 0) return 0;
  return Math.round(ttcCents / (1 + VAT_RATE_FOOD));
}

/**
 * Commission Klik&Go en cents pour une commande.
 *
 * ⚠️ FIX AUDIT I4 — La commission est calculée sur le HT, JAMAIS sur le TTC.
 * Le panier client est en TTC (TVA 5,5% incluse). Si on prend la commission
 * sur le TTC, on prend une part de la TVA collectée par le boucher → erreur
 * fiscale grave (TVA déclarée < TVA collectée → redressement URSSAF/DGFiP).
 *
 * Convention : ce paramètre `orderSubtotalTtcCents` reçoit le total TTC du panier.
 * En interne, on ramène en HT via ttcToHtCents() avant d'appliquer le taux.
 *
 * @param orderSubtotalTtcCents - Total panier TTC en cents (panier client)
 * @param effectiveCommissionRate - Taux commission effectif (0.05 à 0.08)
 * @returns Commission en cents (HT × taux)
 */
export function computeOrderCommission(
  orderSubtotalTtcCents: number,
  effectiveCommissionRate: number,
): number {
  if (orderSubtotalTtcCents <= 0) return 0;
  // Conversion TTC → HT obligatoire pour ne pas prélever de TVA boucher
  const subtotalHtCents = ttcToHtCents(orderSubtotalTtcCents);
  return Math.round(subtotalHtCents * effectiveCommissionRate);
}

/**
 * Variante explicite : commission directement à partir d'un montant HT.
 * À utiliser quand l'appelant a déjà fait la conversion TTC→HT (par ex.
 * un order avec `vatAmountCents` séparé).
 */
export function computeOrderCommissionFromHt(
  orderSubtotalHtCents: number,
  effectiveCommissionRate: number,
): number {
  if (orderSubtotalHtCents <= 0) return 0;
  return Math.round(orderSubtotalHtCents * effectiveCommissionRate);
}

/**
 * Calcule le breakdown complet d'une commande pour Stripe Connect.
 *
 * Flow :
 * - Le client paie : subtotal TTC + frais service (= totalToPay)
 * - Stripe transfère au boucher : subtotal TTC - commission (calculée sur HT)
 * - Klik&Go conserve : commission % HT + frais service (- frais Stripe absorbés)
 *
 * platformFeeCents (= application_fee_amount Stripe) = commission + service fee
 *
 * ⚠️ Le paramètre `orderSubtotalCents` est le panier TTC (TVA 5,5% viande incluse).
 * `computeOrderCommission` se charge de ramener en HT pour le calcul commission.
 * Le boucher conserve donc 100% de sa TVA collectée (obligation fiscale).
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
  const subtotal = input.orderSubtotalCents; // TTC
  // Commission calculée sur HT (computeOrderCommission ramène en HT en interne — fix I4)
  const commission = computeOrderCommission(subtotal, input.effectiveCommissionRate);
  const platformFee = commission + SERVICE_FEE_CENTS;
  // Le boucher reçoit le TTC moins la commission HT → conserve 100% de sa TVA
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
