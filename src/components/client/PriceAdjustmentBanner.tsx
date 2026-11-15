// PriceAdjustmentBanner — the customer's side of a price adjustment, on his tracking pages. A price
// beyond his weighing tolerance waits for his explicit yes until answerBy (legacy rows: createdAt +
// the answer window); silence keeps the price. The server decides (adjustment-answers.ts).
"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { ADJUSTMENT_ANSWER_WINDOW_SECONDS } from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

/** What the banner reads of Order.priceAdjustment in the customer view (dates as ISO strings). */
export interface PriceAdjustmentView {
  id: string;
  originalTotal: number;
  newTotal: number;
  reason: string | null;
  status: string;
  closeReason: string | null;
  answerBy: string | null;
  createdAt: string;
}

type Props = { orderId: string; adjustment: PriceAdjustmentView; onUpdate: () => void };
type Answer = "reject" | "accept";
type ApiBody = { success?: boolean; error?: { message?: string } } | null;
const SILENCE_KEEPS_PRICE = "Sans réponse de votre part dans ce délai, le prix ne change pas.";
const EXPIRED = "Délai dépassé : le prix de votre commande n'a pas changé.";
const NOT_APPLIED = "Ajustement non appliqué : le prix n'a pas changé.";
const DECREASED = "Bonne nouvelle : le prix a baissé";
const WITHIN_TOLERANCE = "Prix ajusté après la pesée, dans la marge que vous avez choisie";
const NETWORK_ERROR = "Erreur réseau : votre réponse n'est pas partie. Réessayez.";
const UNRECORDED = "Votre réponse n'a pas été enregistrée. Réessayez.";
const AMBER_TEXT = "text-amber-900 dark:text-amber-200";
const STRONG_TEXT = "font-bold text-gray-900 dark:text-white";
const ERROR_TEXT = "text-xs text-red-700 dark:text-red-400";
const PENDING_TONE =
  "space-y-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-950/30";
const REJECT =
  "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/30";
const ACCEPT = "bg-emerald-700 text-white hover:bg-emerald-800";
const ANSWERS: Record<Answer, { label: string; done: string; style: string }> = {
  reject: { label: "Refuser", done: "Nouveau prix refusé : le prix ne change pas", style: REJECT },
  accept: { label: "Accepter", done: "Nouveau prix accepté", style: ACCEPT },
};

const signed = (cents: number) =>
  `${cents > 0 ? "+" : cents < 0 ? "-" : ""}${formatPrice(Math.abs(cents))}`;
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Posts the answer. message: null once recorded, else what to show; reached: the server answered. */
async function postAnswer(orderId: string, answer: Answer) {
  const url = `/api/orders/${encodeURIComponent(orderId)}/adjustment/${answer}`;
  const res = await fetch(url, { method: "POST" }).catch((error: unknown) => {
    if (error instanceof TypeError) return null;
    throw error;
  });
  if (res === null) return { message: NETWORK_ERROR, reached: false };
  // A body that is not JSON is an unexpected answer: shown as « not recorded ».
  const body = (await res.json().catch(() => null)) as ApiBody;
  if (res.ok && body?.success === true) return { message: null, reached: true };
  return { message: body?.error?.message ?? UNRECORDED, reached: true };
}

function PendingPrompt({ orderId, adjustment, onUpdate }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expiryNotified = useRef(false);
  // Epoch ms after which the customer can no longer answer.
  const deadline =
    adjustment.answerBy !== null
      ? Date.parse(adjustment.answerBy)
      : Date.parse(adjustment.createdAt) + ADJUSTMENT_ANSWER_WINDOW_SECONDS * 1000;

  // The clock is read after mount only; the interval only counts, it never calls the network.
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [deadline]);

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

  const rows = [
    ["Prix actuel", formatPrice(adjustment.originalTotal), "text-gray-900 dark:text-white"],
    ["Nouveau prix", formatPrice(adjustment.newTotal), STRONG_TEXT],
    ["Différence", signed(adjustment.newTotal - adjustment.originalTotal), STRONG_TEXT],
  ];

  return (
    <section className={`rounded-2xl border ${PENDING_TONE}`}>
      <h3 className={`flex items-center gap-2 text-sm font-bold ${AMBER_TEXT}`}>
        <Scale size={18} aria-hidden="true" className="shrink-0" />
        Votre boucher propose un nouveau prix
      </h3>
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-white p-3 text-center dark:bg-[#141414]">
        {rows.map(([term, value, tone]) => (
          <div key={term}>
            <dt className="text-xs text-gray-600 dark:text-gray-400">{term}</dt>
            <dd className={`text-sm ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {adjustment.reason && <p className={`text-xs ${AMBER_TEXT}`}>Motif : {adjustment.reason}</p>}
      {secondsLeft === 0 ? (
        <p className={`text-sm font-semibold ${AMBER_TEXT}`}>{EXPIRED}</p>
      ) : (
        <>
          {secondsLeft !== null && (
            <p className={`text-xs ${AMBER_TEXT}`}>
              Il vous reste <b role="timer">{clock(secondsLeft)}</b> pour répondre.
            </p>
          )}
          <p className={`text-xs ${AMBER_TEXT}`}>{SILENCE_KEEPS_PRICE}</p>
          {error && (
            <p role="alert" className={ERROR_TEXT}>
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

/** Text of each settled status (AUTO_VALIDATED, ESCALATED: legacy) and those whose price applies. */
const OUTCOMES: Partial<Record<string, (a: PriceAdjustmentView) => string>> = {
  AUTO_APPROVED: (a) => (a.newTotal < a.originalTotal ? DECREASED : WITHIN_TOLERANCE),
  APPROVED: () => "Nouveau prix accepté",
  AUTO_VALIDATED: () => "Prix ajusté",
  REJECTED: (a) =>
    a.closeReason === "CUSTOMER_REFUSED"
      ? `Vous avez refusé le nouveau prix : votre commande reste à ${formatPrice(a.originalTotal)}.`
      : a.closeReason === "NO_ANSWER"
        ? EXPIRED
        : NOT_APPLIED,
  ESCALATED: () => NOT_APPLIED,
};
const APPLIED = ["AUTO_APPROVED", "APPROVED", "AUTO_VALIDATED"];
const APPLIED_TONE =
  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300";
const KEPT_TONE =
  "border-[#ece8e3] bg-white text-gray-800 dark:border-white/10 dark:bg-[#141414] dark:text-gray-200";

export default function PriceAdjustmentBanner(props: Props) {
  const { adjustment } = props;
  if (adjustment.status === "PENDING") return <PendingPrompt key={adjustment.id} {...props} />;
  const text = OUTCOMES[adjustment.status]?.(adjustment);
  if (text === undefined) return null;
  const applied = APPLIED.includes(adjustment.status);
  const [Icon, tone] = applied ? [CheckCircle2, APPLIED_TONE] : [Info, KEPT_TONE];
  const change = `${formatPrice(adjustment.originalTotal)} → ${formatPrice(adjustment.newTotal)}`;
  return (
    <div className={`flex items-start gap-2 rounded-2xl border p-3 ${tone}`}>
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">{text}</p>
        {applied && <p className="text-xs">{change}</p>}
      </div>
    </div>
  );
}
