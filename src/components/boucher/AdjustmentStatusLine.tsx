// AdjustmentStatusLine — where the last price adjustment of an order stands, on its kitchen card.
// The board refreshes the adjustment (the server closes an unanswered one on read: silence is a
// refusal); this line only counts down to the customer's deadline, locally and after mount.
"use client";

import { useEffect, useState } from "react";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { formatPriceCents as formatPrice } from "@/lib/format-kitchen";

type Adjustment = NonNullable<KitchenOrder["priceAdjustment"]>;

const NEXT_STEP = "prix inchangé. Repesez dans sa marge ou retirez l'article.";

/** Why an adjustment ended unapplied (REJECTED), by the closeReason the server recorded. */
function closedText(closeReason: string | null): string {
  if (closeReason === "CUSTOMER_REFUSED") return `Refusé par le client — ${NEXT_STEP}`;
  if (closeReason === "NO_ANSWER") return `Sans réponse du client — ${NEXT_STEP}`;
  return "Ajustement annulé : la commande a changé.";
}

/** "4:05": minutes and seconds left, rounded up to the second. */
function formatTimeLeft(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Milliseconds left until `deadline`, ticking every second; null before mount or without one. */
function useTimeLeft(deadline: string | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) {
      setLeft(null);
      return;
    }
    const end = new Date(deadline).getTime();
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      return ms;
    };
    if (tick() === 0) return;
    const timer = setInterval(() => {
      if (tick() === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return left;
}

const BOX = "mx-3 mb-1.5 rounded-lg border px-3 py-1.5 text-center";
const APPLIED = `${BOX} border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400`;

export default function AdjustmentStatusLine({ adjustment }: { adjustment: Adjustment }) {
  const timeLeft = useTimeLeft(adjustment.status === "PENDING" ? adjustment.answerBy : null);
  const newTotal = formatPrice(adjustment.newTotal);

  switch (adjustment.status) {
    case "PENDING":
      return (
        <div className={`${BOX} border-amber-500/30 bg-amber-500/15`}>
          <p className="text-xs font-bold text-amber-400">
            <span>En attente du client</span>
            {timeLeft !== null && (
              <>
                {" · "}
                <span className="tabular-nums">
                  {timeLeft > 0 ? `${formatTimeLeft(timeLeft)} pour répondre` : "délai écoulé"}
                </span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-amber-300">
            {`${formatPrice(adjustment.originalTotal)} → ${newTotal}`}
          </p>
        </div>
      );
    // AUTO_VALIDATED: applied after a delay by the former rule, on rows written before it ended.
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
