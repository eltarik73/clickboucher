// AdjustmentDecisionNotice — tells the butcher, before he sends a price adjustment, what the server
// will do with it: apply it at once or ask the customer. The decision comes from decideAdjustment
// (src/lib/pricing/tolerance.ts), the server's own rule; only the words are chosen here.
import { CheckCircle2, Clock } from "lucide-react";
import { formatPriceCents as formatPrice } from "@/lib/format-kitchen";
import { ADJUSTMENT_ANSWER_WINDOW_SECONDS, type AdjustmentDecision } from "@/lib/pricing/tolerance";

const ANSWER_MINUTES = ADJUSTMENT_ANSWER_WINDOW_SECONDS / 60;

/** The sentence the butcher reads for a decision. */
export function adjustmentDecisionText(decision: AdjustmentDecision): string {
  const tolerance = formatPrice(decision.toleranceCents);
  switch (decision.reason) {
    case "DECREASE":
      return "Baisse de prix : appliquée tout de suite, le client est prévenu.";
    case "WITHIN_TOLERANCE":
      return `Dans la marge de pesée du client (jusqu'à ${tolerance}) : appliqué sans le déranger.`;
    case "BEYOND_TOLERANCE":
      return (
        `Au-delà de la marge du client (${tolerance}) : il doit accepter. ` +
        `Sans réponse sous ${ANSWER_MINUTES} minutes, le prix ne change pas.`
      );
    case "NOT_WEIGHING":
      return "Hausse hors pesée : le client doit accepter.";
    case "NO_TOLERANCE":
      return "Commande sans marge de pesée : toute hausse demande l'accord du client.";
  }
}

export default function AdjustmentDecisionNotice({ decision }: { decision: AdjustmentDecision }) {
  const applied = decision.decision === "APPLY";
  const Icon = applied ? CheckCircle2 : Clock;
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
      <p className={`text-sm ${applied ? "text-emerald-300" : "text-amber-300"}`}>
        {adjustmentDecisionText(decision)}
      </p>
    </div>
  );
}
