// AdjustmentDecisionNotice — tells the butcher, before he sends a price adjustment, what the server
// will do with it: apply it at once or ask the customer. The decision comes from decideAdjustment
// (src/lib/pricing/tolerance.ts), the server's own rule; only the words are chosen here. A weighing
// increase is measured from the order, not from this step: the notice shows both figures the rule
// compares, the increase cumulated since the order and the customer's tolerance.
import { CheckCircle2, Clock } from "lucide-react";
import { formatPriceCents as formatPrice } from "@/lib/format-kitchen";
import { ADJUSTMENT_ANSWER_WINDOW_SECONDS, type AdjustmentDecision } from "@/lib/pricing/tolerance";

const ANSWER_MINUTES = ADJUSTMENT_ANSWER_WINDOW_SECONDS / 60;

/** The sentence the butcher reads for a decision. */
export function adjustmentDecisionText(decision: AdjustmentDecision): string {
  switch (decision.reason) {
    case "DECREASE":
      return "Baisse de prix : appliquée tout de suite, le client est prévenu.";
    case "WITHIN_TOLERANCE":
      return "Dans la marge de pesée du client : appliqué sans le déranger.";
    case "BEYOND_TOLERANCE":
      return (
        "Au-delà de la marge de pesée du client : il doit accepter. " +
        `Sans réponse sous ${ANSWER_MINUTES} minutes, le prix ne change pas.`
      );
    case "NOT_WEIGHING":
      return "Hausse hors pesée : le client doit accepter.";
    case "NO_TOLERANCE":
      return "Commande sans marge de pesée : toute hausse demande l'accord du client.";
  }
}

/**
 * The two figures a weighing increase is judged on, or null when the tolerance played no part:
 * « Hausse cumulée depuis la commande : 1,60 €, marge du client : 1,22 € ».
 */
export function adjustmentMeasureText(decision: AdjustmentDecision): string | null {
  if (decision.reason !== "WITHIN_TOLERANCE" && decision.reason !== "BEYOND_TOLERANCE") return null;
  const tolerance = formatPrice(decision.toleranceCents);
  if (decision.cumulatedIncreaseCents === null) return `Marge du client : ${tolerance}`;
  const cumulated = formatPrice(decision.cumulatedIncreaseCents);
  return `Hausse cumulée depuis la commande : ${cumulated}, marge du client : ${tolerance}`;
}

export default function AdjustmentDecisionNotice({ decision }: { decision: AdjustmentDecision }) {
  const applied = decision.decision === "APPLY";
  const Icon = applied ? CheckCircle2 : Clock;
  const measure = adjustmentMeasureText(decision);
  return (
    <div
      data-decision={decision.decision}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${
        applied ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"
      }`}
    >
      <Icon
        size={16}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${applied ? "text-emerald-400" : "text-amber-400"}`}
      />
      <div className={`space-y-1 ${applied ? "text-emerald-300" : "text-amber-300"}`}>
        <p className="text-sm">{adjustmentDecisionText(decision)}</p>
        {measure !== null && <p className="text-xs font-medium">{measure}</p>}
      </div>
    </div>
  );
}
