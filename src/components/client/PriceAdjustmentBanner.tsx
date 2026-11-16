// PriceAdjustmentBanner — the customer's side of a price adjustment, on his tracking pages. A price
// beyond his weighing tolerance waits for his explicit yes until its deadline
// (adjustmentAnswerDeadline); silence keeps the price. The server decides (adjustment-answers.ts).
"use client";

import { useEffect, useRef, useState } from "react";
import type { AdjustmentCloseReason, AdjustmentStatus } from "@prisma/client";
import { CheckCircle2, Info, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { formatMinutesSeconds, useSecondsUntil } from "@/hooks/use-seconds-until";
import { refusalMessageOf } from "@/lib/api/client-refusal";
import { isAdjustmentApplied } from "@/lib/pricing/adjustment";
import { adjustmentAnswerDeadline } from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

/** What the banner reads of Order.priceAdjustment in the customer view (dates as ISO strings). */
export interface PriceAdjustmentView {
  id: string;
  originalTotal: number;
  newTotal: number;
  reason: string | null;
  status: AdjustmentStatus;
  closeReason: AdjustmentCloseReason | null;
  /** Deadline of the customer's answer; null on rows without a stored deadline. */
  answerBy: string | null;
  createdAt: string;
}

type Props = { orderId: string; adjustment: PriceAdjustmentView; onUpdate: () => void };
type Answer = "reject" | "accept";

const EXPIRED = "Délai dépassé : le prix de votre commande n'a pas changé.";
const NOT_APPLIED = "Ajustement non appliqué : le prix n'a pas changé.";
const UNRECORDED = "Votre réponse n'a pas été enregistrée. Réessayez.";
const AMBER_TEXT = "text-amber-900 dark:text-amber-200";
const TERM = "text-xs text-gray-600 dark:text-gray-400";
const FIGURE = "text-sm font-bold text-gray-900 dark:text-white";
const ANSWERS: Record<Answer, { label: string; done: string; style: string }> = {
  reject: {
    label: "Refuser",
    done: "Nouveau prix refusé : le prix ne change pas",
    style:
      "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/30",
  },
  accept: {
    label: "Accepter",
    done: "Nouveau prix accepté",
    style: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
};

/** Posts the answer. message: null once recorded, else what to show; reached: the server answered. */
async function postAnswer(orderId: string, answer: Answer) {
  const url = `/api/orders/${encodeURIComponent(orderId)}/adjustment/${answer}`;
  const res = await fetch(url, { method: "POST" }).catch((error: unknown) => {
    if (error instanceof TypeError) return null;
    throw error;
  });
  if (res === null) {
    return {
      message: "Erreur réseau : votre réponse n'est pas partie. Réessayez.",
      reached: false,
    };
  }
  // A body that is not the success envelope is an unexpected answer: shown as « not recorded ».
  const body: unknown = await res.json().catch(() => null);
  const recorded =
    res.ok &&
    typeof body === "object" &&
    body !== null &&
    "success" in body &&
    body.success === true;
  return { message: recorded ? null : (refusalMessageOf(body) ?? UNRECORDED), reached: true };
}

function PendingPrompt({ orderId, adjustment, onUpdate }: Props) {
  const [busy, setBusy] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expiryNotified = useRef(false);
  const secondsLeft = useSecondsUntil(
    adjustmentAnswerDeadline({
      answerBy: adjustment.answerBy === null ? null : new Date(adjustment.answerBy),
      createdAt: new Date(adjustment.createdAt),
    }).getTime()
  );

  // Past the deadline the server closes the adjustment: the page reads the order again, once.
  useEffect(() => {
    if (secondsLeft !== 0 || expiryNotified.current) return;
    expiryNotified.current = true;
    onUpdate();
  }, [secondsLeft, onUpdate]);

  const answer = async (choice: Answer) => {
    setBusy(choice);
    setError(null);
    const { message, reached } = await postAnswer(orderId, choice);
    setBusy(null);
    if (message === null) toast.success(ANSWERS[choice].done);
    else setError(message);
    if (reached) onUpdate();
  };

  const difference = adjustment.newTotal - adjustment.originalTotal;

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
      <h3 className={`flex items-center gap-2 text-sm font-bold ${AMBER_TEXT}`}>
        <Scale size={18} aria-hidden="true" className="shrink-0" />
        Votre boucher propose un nouveau prix
      </h3>
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-white p-3 text-center dark:bg-[#141414]">
        <div>
          <dt className={TERM}>Prix actuel</dt>
          <dd className="text-sm text-gray-900 dark:text-white">
            {formatPrice(adjustment.originalTotal)}
          </dd>
        </div>
        <div>
          <dt className={TERM}>Nouveau prix</dt>
          <dd className={FIGURE}>{formatPrice(adjustment.newTotal)}</dd>
        </div>
        <div>
          <dt className={TERM}>Différence</dt>
          <dd className={FIGURE}>{`${difference > 0 ? "+" : ""}${formatPrice(difference)}`}</dd>
        </div>
      </dl>
      {adjustment.reason && <p className={`text-xs ${AMBER_TEXT}`}>Motif : {adjustment.reason}</p>}
      {secondsLeft === 0 ? (
        <p className={`text-sm font-semibold ${AMBER_TEXT}`}>{EXPIRED}</p>
      ) : (
        <>
          {secondsLeft !== null && (
            <p className={`text-xs ${AMBER_TEXT}`}>
              Il vous reste <b role="timer">{formatMinutesSeconds(secondsLeft)}</b> pour répondre.
            </p>
          )}
          <p className={`text-xs ${AMBER_TEXT}`}>
            Sans réponse de votre part dans ce délai, le prix ne change pas.
          </p>
          {error && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            {(["reject", "accept"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => void answer(choice)}
                disabled={busy !== null}
                aria-busy={busy === choice}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${ANSWERS[choice].style}`}
              >
                {busy === choice && <Loader2 size={16} aria-hidden className="animate-spin" />}
                {ANSWERS[choice].label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Why an adjustment ended unapplied (REJECTED), by the reason the server recorded. */
const CLOSED: Record<AdjustmentCloseReason, string> = {
  CUSTOMER_REFUSED: "Vous avez refusé le nouveau prix : le prix de votre commande n'a pas changé.",
  NO_ANSWER: EXPIRED,
  ORDER_CHANGED: NOT_APPLIED,
};

/** The sentence of a settled adjustment; AUTO_VALIDATED and ESCALATED exist on older rows only. */
const SETTLED: Record<Exclude<AdjustmentStatus, "PENDING">, (a: PriceAdjustmentView) => string> = {
  AUTO_APPROVED: (a) =>
    a.newTotal < a.originalTotal
      ? "Bonne nouvelle : le prix a baissé"
      : "Prix ajusté après la pesée, dans la marge que vous avez choisie",
  APPROVED: () => "Nouveau prix accepté",
  AUTO_VALIDATED: () => "Prix ajusté",
  REJECTED: (a) => (a.closeReason === null ? NOT_APPLIED : CLOSED[a.closeReason]),
  ESCALATED: () => NOT_APPLIED,
};

export default function PriceAdjustmentBanner(props: Props) {
  const { adjustment } = props;
  if (adjustment.status === "PENDING") return <PendingPrompt key={adjustment.id} {...props} />;
  const applied = isAdjustmentApplied(adjustment.status);
  const tone = applied
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-[#ece8e3] bg-white text-gray-800 dark:border-white/10 dark:bg-[#141414] dark:text-gray-200";
  return (
    <div className={`flex items-start gap-2 rounded-2xl border p-3 ${tone}`}>
      {applied ? (
        <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      ) : (
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      )}
      <div className="text-sm">
        <p className="font-semibold">{SETTLED[adjustment.status](adjustment)}</p>
        {applied && (
          <p className="text-xs">
            {`${formatPrice(adjustment.originalTotal)} → ${formatPrice(adjustment.newTotal)}`}
          </p>
        )}
      </div>
    </div>
  );
}
