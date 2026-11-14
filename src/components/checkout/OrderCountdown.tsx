"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { CheckoutSubmission } from "@/lib/cart/order-payload";

// ── Types ────────────────────────────────────────────────────

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  guestToken?: string;
}

interface OrderCountdownProps {
  /** Endpoint and body from buildCheckoutSubmission. */
  submission: CheckoutSubmission;
  itemCount: number;
  totalCents: number;
  shopName: string | null;
  pickupLabel: string;
  onCancel: () => void;
  onSuccess: (order: PlacedOrder) => void;
  onError: (missingProductIds?: string[]) => void;
  onPriceChanged: (message: string) => void;
  duration?: number;
}

type Status = "countdown" | "sending" | "success" | "error";

// ── Helpers ──────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

const CIRCUMFERENCE = 2 * Math.PI * 54;
const SUCCESS_DELAY_MS = 2000;

interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: { missingProductIds?: string[] };
}

/** The order of a 201 or of a 200 replay. The guest endpoint answers { order, guestToken }. */
function placedOrderFrom(data: unknown): PlacedOrder | null {
  if (data === null || typeof data !== "object") return null;
  const body = data as { order?: unknown; guestToken?: unknown };
  const order = (body.order ?? data) as { id?: unknown; orderNumber?: unknown };
  if (typeof order.id !== "string" || typeof order.orderNumber !== "string") return null;
  const guestToken =
    body.order && typeof body.guestToken === "string" ? body.guestToken : undefined;
  return { id: order.id, orderNumber: order.orderNumber, ...(guestToken && { guestToken }) };
}

// ── Component ────────────────────────────────────────────────

export function OrderCountdown({
  submission,
  itemCount,
  totalCents,
  shopName,
  pickupLabel,
  onCancel,
  onSuccess,
  onError,
  onPriceChanged,
  duration = 5,
}: OrderCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [status, setStatus] = useState<Status>("countdown");
  const [errorMsg, setErrorMsg] = useState("");
  const cancelledRef = useRef(false);
  const missingIdsRef = useRef<string[]>([]);
  /** Countdown round whose request has been sent; a round sends exactly once. */
  const sentRoundRef = useRef<number | null>(null);
  const [round, setRound] = useState(0);
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Submit ───────────────────────────────────────────────

  const submitOrder = useCallback(async () => {
    setStatus("sending");
    let res: Response;
    let body: { success?: boolean; data?: unknown; error?: ApiErrorBody } | null;
    try {
      res = await fetch(submission.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission.body),
      });
      body = await res.json().catch(() => null);
    } catch {
      if (cancelledRef.current) return;
      setErrorMsg("Erreur réseau, réessayez");
      setStatus("error");
      return;
    }
    if (cancelledRef.current) return;

    const order = res.ok && body?.success ? placedOrderFrom(body.data) : null;
    if (order) {
      setStatus("success");
      if (navigator.vibrate) navigator.vibrate(200);
      setTimeout(() => {
        if (!cancelledRef.current) onSuccess(order);
      }, SUCCESS_DELAY_MS);
      return;
    }

    const error = body?.error;
    if (res.status === 409 && error?.code === "PRICE_CHANGED") {
      cancelledRef.current = true;
      onPriceChanged(error.message || "Le total de votre commande a changé.");
      return;
    }
    missingIdsRef.current =
      error?.code === "PRODUCTS_MISSING" ? (error.details?.missingProductIds ?? []) : [];
    setErrorMsg(error?.message || "Erreur lors de la commande");
    setStatus("error");
  }, [submission, onSuccess, onPriceChanged]);

  // ── Countdown timer ──────────────────────────────────────

  useEffect(() => {
    if (status !== "countdown" || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, timeLeft]);

  useEffect(() => {
    if (status !== "countdown" || timeLeft > 0 || cancelledRef.current) return;
    if (sentRoundRef.current === round) return;
    sentRoundRef.current = round;
    void submitOrder();
  }, [status, timeLeft, round, submitOrder]);

  // ── Cancel handler ───────────────────────────────────────

  function handleCancel() {
    cancelledRef.current = true;
    onCancel();
  }

  // ── Retry handler: same body, hence same idempotency key ──

  function handleRetry() {
    setErrorMsg("");
    missingIdsRef.current = [];
    cancelledRef.current = false;
    setRound((r) => r + 1);
    setTimeLeft(duration);
    setStatus("countdown");
  }

  // ── Render ───────────────────────────────────────────────

  const progress = status === "countdown" ? (timeLeft / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-zinc-950"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmation de commande"
    >
      <div className="flex w-full max-w-sm flex-col items-center px-6">
        {/* ── Circle ── */}
        <div className="relative mb-6 h-28 w-28">
          {status === "countdown" && (
            <>
              <svg className="h-28 w-28" viewBox="0 0 120 120" aria-hidden="true">
                {/* Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-zinc-800"
                  strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - progress / 100)}
                  className="origin-center -rotate-90"
                  style={
                    prefersReducedMotion ? undefined : { transition: "stroke-dashoffset 1s linear" }
                  }
                />
              </svg>
              {/* Counter */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                aria-live="polite"
                aria-label={`${timeLeft} secondes avant envoi`}
              >
                <span
                  key={timeLeft}
                  className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white"
                  style={
                    prefersReducedMotion
                      ? undefined
                      : {
                          animation: "countPop 0.3s ease-out",
                        }
                  }
                >
                  {timeLeft}
                </span>
              </div>
            </>
          )}

          {status === "sending" && (
            <div className="flex h-28 w-28 items-center justify-center">
              <Loader2 size={48} className="animate-spin text-[#DC2626]" />
            </div>
          )}

          {status === "success" && (
            <div
              className="flex h-28 w-28 items-center justify-center"
              style={prefersReducedMotion ? undefined : { animation: "successPop 0.5s ease-out" }}
            >
              <CheckCircle2 size={64} className="text-emerald-500" strokeWidth={1.5} />
            </div>
          )}

          {status === "error" && (
            <div className="flex h-28 w-28 items-center justify-center">
              <XCircle size={64} className="text-red-500" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* ── Status text ── */}
        <h2 className="text-center text-lg font-semibold text-gray-900 dark:text-white">
          {status === "countdown" && "Envoi de votre commande..."}
          {status === "sending" && "Envoi en cours..."}
          {status === "success" && "Commande envoyée !"}
          {status === "error" && "Oups, une erreur est survenue"}
        </h2>

        {status === "error" && errorMsg && (
          <p className="mt-2 text-center text-sm text-red-500 dark:text-red-400">{errorMsg}</p>
        )}

        {/* ── Progress bar (countdown only) ── */}
        {status === "countdown" && (
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-[#DC2626]"
              style={
                prefersReducedMotion
                  ? { width: `${progress}%` }
                  : {
                      width: `${progress}%`,
                      transition: "width 1s linear",
                    }
              }
            />
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="mt-8 w-full space-y-3">
          {status === "countdown" && (
            <button
              type="button"
              onClick={handleCancel}
              autoFocus
              className="h-14 w-full rounded-xl bg-zinc-200 text-base font-semibold text-gray-900 transition-colors hover:bg-zinc-300 active:scale-[0.98] dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              Annuler
            </button>
          )}

          {status === "error" && (
            <>
              <button
                type="button"
                onClick={handleRetry}
                className="h-14 w-full rounded-xl bg-[#DC2626] text-base font-semibold text-white transition-colors hover:bg-[#b91c1c] active:scale-[0.98]"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelledRef.current = true;
                  onError(missingIdsRef.current.length > 0 ? missingIdsRef.current : undefined);
                }}
                className="h-12 w-full rounded-xl bg-zinc-200 text-sm font-medium text-gray-900 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
              >
                Retour au panier
              </button>
            </>
          )}
        </div>

        {/* ── Mini recap ── */}
        {(status === "countdown" || status === "sending") && (
          <div className="mt-8 space-y-1 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>
              {itemCount} article{itemCount > 1 ? "s" : ""} &middot; {fmtPrice(totalCents)}
            </p>
            {pickupLabel && <p>{pickupLabel}</p>}
            {shopName && <p className="font-medium text-gray-700 dark:text-gray-300">{shopName}</p>}
          </div>
        )}

        {/* ── Success details ── */}
        {status === "success" && (
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {shopName && <>{shopName}</>}
          </p>
        )}
      </div>

      {/* ── Animations ── */}
      <style jsx>{`
        @keyframes countPop {
          0% {
            transform: scale(1.3);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes successPop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          60% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
