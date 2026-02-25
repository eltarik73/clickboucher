"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface OrderCountdownProps {
  orderData: Record<string, unknown>;
  itemCount: number;
  totalCents: number;
  shopName: string | null;
  pickupLabel: string;
  onCancel: () => void;
  onSuccess: (order: { id: string; orderNumber: string }) => void;
  onError: () => void;
  duration?: number;
}

type Status = "countdown" | "sending" | "success" | "error";

// ── Helpers ──────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

const CIRCUMFERENCE = 2 * Math.PI * 54;

// ── Component ────────────────────────────────────────────────

export function OrderCountdown({
  orderData,
  itemCount,
  totalCents,
  shopName,
  pickupLabel,
  onCancel,
  onSuccess,
  onError,
  duration = 5,
}: OrderCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [status, setStatus] = useState<Status>("countdown");
  const [errorMsg, setErrorMsg] = useState("");
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Countdown timer ──────────────────────────────────────

  const submitOrder = useCallback(async () => {
    if (cancelledRef.current) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();

      if (cancelledRef.current) return;

      if (res.ok && data.success) {
        setStatus("success");
        // Vibrate on success
        if (navigator.vibrate) navigator.vibrate(200);
        // Wait 2s then callback
        setTimeout(() => {
          if (!cancelledRef.current) onSuccess(data.data);
        }, 2000);
      } else {
        const msg =
          data.error?.message || "Erreur lors de la commande";
        const details = data.error?.details;
        const detailStr = details
          ? " — " +
            Object.entries(details)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")
          : "";
        setErrorMsg(msg + detailStr);
        setStatus("error");
      }
    } catch {
      if (cancelledRef.current) return;
      setErrorMsg("Erreur reseau, reessayez");
      setStatus("error");
    }
  }, [orderData, onSuccess]);

  useEffect(() => {
    if (status !== "countdown") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitOrder();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, submitOrder]);

  // ── Cancel handler ───────────────────────────────────────

  function handleCancel() {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  }

  // ── Retry handler ────────────────────────────────────────

  function handleRetry() {
    setErrorMsg("");
    setTimeLeft(duration);
    cancelledRef.current = false;
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
      <div className="flex flex-col items-center w-full max-w-sm px-6">
        {/* ── Circle ── */}
        <div className="relative w-28 h-28 mb-6">
          {status === "countdown" && (
            <>
              <svg
                className="w-28 h-28"
                viewBox="0 0 120 120"
                aria-hidden="true"
              >
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
                  className="-rotate-90 origin-center"
                  style={
                    prefersReducedMotion
                      ? undefined
                      : { transition: "stroke-dashoffset 1s linear" }
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
                  className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums"
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
            <div className="w-28 h-28 flex items-center justify-center">
              <Loader2
                size={48}
                className="animate-spin text-[#DC2626]"
              />
            </div>
          )}

          {status === "success" && (
            <div
              className="w-28 h-28 flex items-center justify-center"
              style={
                prefersReducedMotion
                  ? undefined
                  : { animation: "successPop 0.5s ease-out" }
              }
            >
              <CheckCircle2
                size={64}
                className="text-emerald-500"
                strokeWidth={1.5}
              />
            </div>
          )}

          {status === "error" && (
            <div className="w-28 h-28 flex items-center justify-center">
              <XCircle
                size={64}
                className="text-red-500"
                strokeWidth={1.5}
              />
            </div>
          )}
        </div>

        {/* ── Status text ── */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
          {status === "countdown" && "Envoi de votre commande..."}
          {status === "sending" && "Envoi en cours..."}
          {status === "success" && "Commande envoyee !"}
          {status === "error" && "Oups, une erreur est survenue"}
        </h2>

        {status === "error" && errorMsg && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-400 text-center">
            {errorMsg}
          </p>
        )}

        {/* ── Progress bar (countdown only) ── */}
        {status === "countdown" && (
          <div className="w-full h-1 bg-gray-200 dark:bg-zinc-800 rounded-full mt-5 overflow-hidden">
            <div
              className="h-full bg-[#DC2626] rounded-full"
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
        <div className="w-full mt-8 space-y-3">
          {status === "countdown" && (
            <button
              type="button"
              onClick={handleCancel}
              autoFocus
              className="w-full h-14 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-gray-900 dark:text-white text-base font-semibold transition-colors hover:bg-zinc-300 dark:hover:bg-zinc-700 active:scale-[0.98]"
            >
              Annuler
            </button>
          )}

          {status === "error" && (
            <>
              <button
                type="button"
                onClick={handleRetry}
                className="w-full h-14 rounded-xl bg-[#DC2626] text-white text-base font-semibold transition-colors hover:bg-[#b91c1c] active:scale-[0.98]"
              >
                Reessayer
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelledRef.current = true;
                  onError();
                }}
                className="w-full h-12 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm font-medium transition-colors hover:bg-zinc-300 dark:hover:bg-zinc-700"
              >
                Retour au panier
              </button>
            </>
          )}
        </div>

        {/* ── Mini recap ── */}
        {(status === "countdown" || status === "sending") && (
          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>
              {itemCount} article{itemCount > 1 ? "s" : ""} &middot;{" "}
              {fmtPrice(totalCents)}
            </p>
            {pickupLabel && <p>{pickupLabel}</p>}
            {shopName && (
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {shopName}
              </p>
            )}
          </div>
        )}

        {/* ── Success details ── */}
        {status === "success" && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
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
