// ═══════════════════════════════════════════════
// CLICKBOUCHER — Weight Service
// Règle STRICTE ±10% par ligne
// ═══════════════════════════════════════════════

const TOLERANCE_PERCENT = Number(process.env.WEIGHT_TOLERANCE_PERCENT) || 10;

export interface WeightCheck {
  orderItemId: string;
  requestedGrams: number;
  actualGrams: number;
  deviationPercent: number;
  exceeds: boolean;       // > +10%  → client validation required
  underweight: boolean;   // < -10%  → boucher must complete or ask
  adjustedPriceCents: number;
}

/**
 * Check weight deviation for a single order item
 */
export function checkWeightDeviation(
  requestedGrams: number,
  actualGrams: number,
  pricePerKgCents: number,
  orderItemId: string
): WeightCheck {
  const deviationPercent = ((actualGrams - requestedGrams) / requestedGrams) * 100;
  const adjustedPriceCents = Math.round((actualGrams / 1000) * pricePerKgCents);

  return {
    orderItemId,
    requestedGrams,
    actualGrams,
    deviationPercent: Math.round(deviationPercent * 10) / 10,
    exceeds: deviationPercent > TOLERANCE_PERCENT,
    underweight: deviationPercent < -TOLERANCE_PERCENT,
    adjustedPriceCents,
  };
}

/**
 * Check all items in an order and determine next status
 */
export function determinePostWeighingStatus(
  checks: WeightCheck[]
): "WEIGHT_REVIEW" | "READY" {
  const hasExceeding = checks.some((c) => c.exceeds);
  if (hasExceeding) return "WEIGHT_REVIEW";
  return "READY";
}

/**
 * Format weight deviation message for timeline / notification
 */
export function formatWeightMessage(check: WeightCheck): string {
  const direction = check.deviationPercent > 0 ? "+" : "";
  return `Demandé ${check.requestedGrams}g, pesé ${check.actualGrams}g (${direction}${check.deviationPercent}%)`;
}
