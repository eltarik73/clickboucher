// src/components/order/OrderTracker.tsx — 5-step animated order tracker with SSE real-time updates
"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { ClipboardList, CheckCircle, ChefHat, Package, ShoppingBag, X, Clock, Bell, Wifi, WifiOff } from "lucide-react";

type OrderStatus =
  | "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP"
  | "COMPLETED" | "DENIED" | "CANCELLED" | "PARTIALLY_DENIED" | "AUTO_CANCELLED";

const STEPS = [
  { key: "PENDING",   label: "Commande recue",   Icon: ClipboardList },
  { key: "ACCEPTED",  label: "Acceptee",          Icon: CheckCircle },
  { key: "PREPARING", label: "En preparation",    Icon: ChefHat },
  { key: "READY",     label: "Prete !",           Icon: Package },
  { key: "PICKED_UP", label: "Recuperee",         Icon: ShoppingBag },
] as const;

const STEP_INDEX: Record<string, number> = {
  PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3,
  PICKED_UP: 4, COMPLETED: 4, PARTIALLY_DENIED: 0,
};

type Props = {
  orderId?: string;
  status: OrderStatus;
  estimatedReady?: string | null;
  actualReady?: string | null;
  denyReason?: string | null;
  shopName?: string;
  enableSSE?: boolean;
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

export default function OrderTracker({ orderId, status: initialStatus, estimatedReady: initEstimated, actualReady, denyReason: initDenyReason, shopName, enableSSE = true }: Props) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [estimatedReady, setEstimatedReady] = useState(initEstimated);
  const [denyReason, setDenyReason] = useState(initDenyReason);
  const [connected, setConnected] = useState(false);
  const prevStatus = useRef(initialStatus);
  const readySoundPlayed = useRef(false);

  const playSound = useCallback((src: string) => {
    try {
      const audio = new Audio(src);
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!enableSSE || !orderId) return;

    const terminal = ["COMPLETED", "PICKED_UP", "DENIED", "CANCELLED", "AUTO_CANCELLED"];
    if (terminal.includes(initialStatus)) return;

    const es = new EventSource(`/api/orders/${orderId}/stream`);

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "CONNECTED") {
          setConnected(true);
        }

        if (data.type === "STATUS_CHANGED") {
          setStatus(data.status);
          if (data.estimatedReady) setEstimatedReady(data.estimatedReady);
          if (data.denyReason) setDenyReason(data.denyReason);

          // Sound + notification on READY
          if (data.status === "READY" && !readySoundPlayed.current) {
            playSound("/sounds/order-ready.wav");
            readySoundPlayed.current = true;
            navigator.vibrate?.([200, 100, 200]);

            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("Commande prete !", {
                body: shopName ? `Chez ${shopName}` : "Votre commande est prete au retrait",
              });
            }
          }

          if (data.status === "ACCEPTED" && prevStatus.current === "PENDING") {
            playSound("/sounds/notification.mp3");
          }

          if (data.status === "DENIED" || data.status === "CANCELLED" || data.status === "AUTO_CANCELLED") {
            playSound("/sounds/alert.wav");
          }

          prevStatus.current = data.status;
        }
      } catch {}
    };

    // Request notification permission
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => es.close();
  }, [orderId, initialStatus, enableSSE, playSound, shopName]);

  const currentStep = STEP_INDEX[status] ?? -1;
  const isCancelled = ["DENIED", "CANCELLED", "AUTO_CANCELLED"].includes(status);

  const estimatedDisplay = useMemo(() => {
    if (actualReady) return `Prete a ${formatTime(actualReady)}`;
    if (estimatedReady) return `Estimee ~${timeRemaining(estimatedReady)}`;
    return null;
  }, [estimatedReady, actualReady]);

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6">
        <div className="flex items-center gap-3 mb-2">
          <X className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
            {status === "DENIED" ? "Commande refusee" : status === "AUTO_CANCELLED" ? "Commande expiree" : "Commande annulee"}
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
      {/* Connection indicator + time estimate */}
      <div className="flex items-center justify-between mb-6">
        {estimatedDisplay && currentStep < 4 ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{estimatedDisplay}</span>
          </div>
        ) : (
          <div />
        )}

        {enableSSE && orderId && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${connected ? "text-emerald-500" : "text-gray-400"}`}>
            {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
            {connected ? "En direct" : "Reconnexion..."}
          </span>
        )}
      </div>

      {/* Ready banner */}
      {status === "READY" && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 mb-6 text-center animate-pulse">
          <Bell className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            Votre commande est prete !
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
            Rendez-vous en boutique pour la retirer
          </p>
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
                  className={`text-sm font-medium transition-all duration-300 ${
                    isCurrent
                      ? "text-red-600 dark:text-red-500 font-bold"
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
