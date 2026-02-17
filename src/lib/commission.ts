// src/lib/commission.ts — Commission calculation helper

const DEFAULT_COMMISSION_PCT = 5; // 5% par défaut

/**
 * Calcule la commission sur une commande.
 * Priorité : commission custom de la boutique > commission globale par défaut.
 */
export function calculateCommission(
  totalCents: number,
  shopCommissionPct: number | null | undefined,
  shopCommissionEnabled: boolean
): number {
  if (!shopCommissionEnabled) return 0;

  const pct = shopCommissionPct ?? DEFAULT_COMMISSION_PCT;
  return Math.round((totalCents * pct) / 100);
}

/**
 * Calcule le montant net pour le boucher après commission.
 */
export function getNetAmount(totalCents: number, commissionCents: number): number {
  return totalCents - commissionCents;
}
