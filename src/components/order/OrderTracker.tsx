// src/components/order/OrderTracker.tsx — 5-step animated order tracker (Uber Eats style)
"use client";

import { useMemo } from "react";
import { ClipboardList, CheckCircle, ChefHat, Package, ShoppingBag, X, Clock } from "lucide-react";

type OrderStatus =
  | "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP"
  | "COMPLETED" | "DENIED" | "CANCELLED" | "PARTIALLY_DENIED" | "AUTO_CANCELLED";

const STEPS = [
  { key: "PENDING",   label: "Commande reçue",   Icon: ClipboardList },
  { key: "ACCEPTED",  label: "Acceptée",          Icon: CheckCircle },
  { key: "PREPARING", label: "En préparation",    Icon: ChefHat },
  { key: "READY",     label: "Prête !",           Icon: Package },
  { key: "PICKED_UP", label: "Récupérée",         Icon: ShoppingBag },
] as const;

const STEP_INDEX: Record<string, number> = {
  PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3,
  PICKED_UP: 4, COMPLETED: 4, PARTIALLY_DENIED: 0,
};

type Props = {
  status: OrderStatus;
  estimatedReady?: string | null;
  actualReady?: string | null;
  denyReason?: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function timeRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Imminent";
  const min = Math.ceil(diff / 60_000);
  return min > 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

export default function OrderTracker({ status, estimatedReady, actualReady, denyReason }: Props) {
  const currentStep = STEP_INDEX[status] ?? -1;
  const isCancelled = ["DENIED", "CANCELLED", "AUTO_CANCELLED"].includes(status);

  const estimatedDisplay = useMemo(() => {
    if (actualReady) return `Prête à ${formatTime(actualReady)}`;
    if (estimatedReady) return `Estimée ~${timeRemaining(estimatedReady)}`;
    return null;
  }, [estimatedReady, actualReady]);

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6">
        <div className="flex items-center gap-3 mb-2">
          <X className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
            {status === "DENIED" ? "Commande refusée" : status === "AUTO_CANCELLED" ? "Commande expirée" : "Commande annulée"}
          </h3>
        </div>
        {denyReason && (
          <p className="text-sm text-red-600 dark:text-red-400 ml-9">{denyReason}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] p-6">
      {/* Time estimate */}
      {estimatedDisplay && currentStep < 4 && (
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{estimatedDisplay}</span>
        </div>
      )}

      {/* Steps */}
      <div className="relative">
        {STEPS.map((step, i) => {
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          const isPending = i > currentStep;

          return (
            <div key={step.key} className="flex items-start gap-4 relative">
              {/* Vertical line */}
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute left-[19px] top-[40px] w-0.5 h-[calc(100%-16px)] transition-colors duration-500 ${
                    isComplete ? "bg-green-500" : "bg-gray-200 dark:bg-white/10"
                  }`}
                />
              )}

              {/* Icon circle */}
              <div
                className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "bg-red-600 text-white ring-4 ring-red-100 dark:ring-red-900/30 animate-pulse"
                    : "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600"
                }`}
              >
                <step.Icon className="w-5 h-5" />
              </div>

              {/* Label */}
              <div className={`pb-8 pt-2 ${isPending ? "opacity-40" : ""}`}>
                <p
                  className={`text-sm font-medium ${
                    isCurrent
                      ? "text-red-600 dark:text-red-500"
                      : isComplete
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
