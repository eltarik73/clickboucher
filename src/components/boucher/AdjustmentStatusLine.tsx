// AdjustmentStatusLine — where the last price adjustment of an order stands, on its kitchen card.
// The board refreshes the adjustment (the server closes an unanswered one on read: silence is a
// refusal); this line only counts down to the customer's deadline, locally and after mount.
"use client";

import type { KitchenOrder } from "@/hooks/use-order-polling";
import { formatMinutesSeconds, useSecondsUntil } from "@/hooks/use-seconds-until";
import { formatPriceCents as formatPrice } from "@/lib/format-kitchen";

type Adjustment = NonNullable<KitchenOrder["priceAdjustment"]>;

const NEXT_STEP = "prix inchangé. Repesez dans sa marge ou retirez l'article.";

/** Why an adjustment ended unapplied (REJECTED), by the closeReason the server recorded. */
function closedText(closeReason: string | null): string {
  if (closeReason === "CUSTOMER_REFUSED") return `Refusé par le client — ${NEXT_STEP}`;
  if (closeReason === "NO_ANSWER") return `Sans réponse du client — ${NEXT_STEP}`;
  return "Ajustement annulé : la commande a changé.";
}

const BOX = "mx-3 mb-1.5 rounded-lg border px-3 py-1.5 text-center";
const APPLIED = `${BOX} border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400`;

export default function AdjustmentStatusLine({ adjustment }: { adjustment: Adjustment }) {
  // A pending row without a stored deadline shows no time, until the board reads it closed.
  const secondsLeft = useSecondsUntil(
    adjustment.status === "PENDING" && adjustment.answerBy !== null
      ? Date.parse(adjustment.answerBy)
      : null
  );
  const newTotal = formatPrice(adjustment.newTotal);

  switch (adjustment.status) {
    case "PENDING":
      return (
        <div className={`${BOX} border-amber-500/30 bg-amber-500/15`}>
          <p className="text-xs font-bold text-amber-400">
            <span>En attente du client</span>
            {secondsLeft !== null && (
              <>
                {" · "}
                <span className="tabular-nums">
                  {secondsLeft > 0
                    ? `${formatMinutesSeconds(secondsLeft)} pour répondre`
                    : "délai écoulé"}
                </span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-amber-300">
            {`${formatPrice(adjustment.originalTotal)} → ${newTotal}`}
          </p>
        </div>
      );
    // AUTO_VALIDATED: older rows, applied without the customer's answer.
    case "AUTO_APPROVED":
    case "AUTO_VALIDATED":
      return <p className={APPLIED}>{`Prix ajusté (${newTotal})`}</p>;
    case "APPROVED":
      return <p className={APPLIED}>{`Accepté par le client (${newTotal})`}</p>;
    case "REJECTED":
      return (
        <p className={`${BOX} border-red-500/20 bg-red-500/10 text-xs text-red-400`}>
          {closedText(adjustment.closeReason)}
        </p>
      );
    default:
      return null;
  }
}
