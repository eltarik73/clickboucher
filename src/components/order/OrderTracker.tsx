// src/components/order/OrderTracker.tsx — Premium order tracker with horizontal progress, live countdown, SSE
"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { ClipboardList, CheckCircle, ChefHat, Package, ShoppingBag, X, Clock, Bell, Wifi, WifiOff } from "lucide-react";

type OrderStatus =
  | "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP"
  | "COMPLETED" | "DENIED" | "CANCELLED" | "PARTIALLY_DENIED" | "AUTO_CANCELLED";

const STEPS = [
  { key: "PENDING",   label: "Envoyée",        shortLabel: "Envoyée",   Icon: ClipboardList },
  { key: "ACCEPTED",  label: "Acceptée",        shortLabel: "Acceptée",  Icon: CheckCircle },
  { key: "PREPARING", label: "En préparation",  shortLabel: "Prépa.",    Icon: ChefHat },
  { key: "READY",     label: "Prête !",         shortLabel: "Prête !",   Icon: Package },
  { key: "PICKED_UP", label: "Récupérée",       shortLabel: "Récup.",    Icon: ShoppingBag },
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

// ── Live Countdown Hook ──────────────────────────
function useCountdown(targetIso: string | null | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!targetIso) { setRemaining(null); return; }

    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetIso]);

  if (remaining === null) return null;
  if (remaining <= 0) return "Imminent";

  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${String(m).padStart(2, "0")}`;
  }
  return min > 0 ? `${min}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

// ── Main Component ───────────────────────────────

export default function OrderTracker({ orderId, status: initialStatus, estimatedReady: initEstimated, actualReady, denyReason: initDenyReason, shopName, enableSSE = true }: Props) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [estimatedReady, setEstimatedReady] = useState(initEstimated);
  const [denyReason, setDenyReason] = useState(initDenyReason);
  const [connected, setConnected] = useState(false);
  const prevStatus = useRef(initialStatus);
  const readySoundPlayed = useRef(false);

  const countdown = useCountdown(actualReady || estimatedReady);

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

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let es: EventSource;

    function connect() {
      es = new EventSource(`/api/orders/${orderId}/stream`);

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es.close();
        // Auto-reconnect after 3s
        reconnectTimeout = setTimeout(connect, 3000);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "CONNECTED") setConnected(true);

          if (data.type === "STATUS_CHANGED") {
            setStatus(data.status);
            if (data.estimatedReady) setEstimatedReady(data.estimatedReady);
            if (data.denyReason) setDenyReason(data.denyReason);

            if (data.status === "READY" && !readySoundPlayed.current) {
              playSound("/sounds/order-ready.wav");
              readySoundPlayed.current = true;
              navigator.vibrate?.([200, 100, 200]);
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("Commande prête !", {
                  body: shopName ? `Chez ${shopName}` : "Votre commande est prête au retrait",
                });
              }
            }
            if (data.status === "ACCEPTED" && prevStatus.current === "PENDING") {
              playSound("/sounds/notification.mp3");
            }
            if (["DENIED", "CANCELLED", "AUTO_CANCELLED"].includes(data.status)) {
              playSound("/sounds/alert.wav");
            }
            prevStatus.current = data.status;
          }
        } catch {}
      };
    }

    connect();

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      es?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [orderId, initialStatus, enableSSE, playSound, shopName]);

  const currentStep = STEP_INDEX[status] ?? -1;
  const isCancelled = ["DENIED", "CANCELLED", "AUTO_CANCELLED"].includes(status);
  const progressPct = Math.min(100, (currentStep / (STEPS.length - 1)) * 100);

  const timeLabel = useMemo(() => {
    if (actualReady) return `Prête à ${formatTime(actualReady)}`;
    if (estimatedReady) return `Estimée vers ${formatTime(estimatedReady)}`;
    return null;
  }, [estimatedReady, actualReady]);

  // ── Cancelled state ──
  if (isCancelled) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <X className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-red-700 dark:text-red-400">
              {status === "DENIED" ? "Commande refusée" : status === "AUTO_CANCELLED" ? "Commande expirée" : "Commande annulée"}
            </h3>
            {denyReason && (
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">{denyReason}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Active order ──
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] overflow-hidden">
      {/* Top: countdown + connection status */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          {/* Countdown */}
          {countdown && currentStep < 4 ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#DC2626]" />
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">
                  {countdown}
                </p>
                {timeLabel && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{timeLabel}</p>
                )}
              </div>
            </div>
          ) : currentStep >= 4 ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Terminée</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center animate-pulse">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">En attente...</p>
            </div>
          )}

          {/* SSE indicator */}
          {enableSSE && orderId && (
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
              connected
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                : "bg-gray-50 dark:bg-white/5 text-gray-400"
            }`}>
              {connected ? <Wifi size={9} /> : <WifiOff size={9} />}
              {connected ? "Direct" : "..."}
            </span>
          )}
        </div>
      </div>

      {/* Horizontal progress bar */}
      <div className="px-5 pb-2">
        <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${progressPct}%`,
              background: currentStep >= 3
                ? "linear-gradient(90deg, #10b981, #059669)"
                : "linear-gradient(90deg, #DC2626, #ef4444)",
            }}
          />
        </div>
      </div>

      {/* Ready banner */}
      {status === "READY" && (
        <div className="mx-5 mb-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-emerald-600 animate-bounce" />
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
              Votre commande est prête !
            </p>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            Rendez-vous chez {shopName || "le boucher"} pour la retirer
          </p>
        </div>
      )}

      {/* Horizontal steps */}
      <div className="px-5 pb-5 pt-2">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const isComplete = i < currentStep;
            const isCurrent = i === currentStep;
            const isPending = i > currentStep;

            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative">
                {/* Connector line (between steps) */}
                {i > 0 && (
                  <div
                    className={`absolute top-[15px] right-1/2 w-full h-0.5 -z-0 transition-colors duration-700 ${
                      isComplete || isCurrent ? "bg-[#DC2626]" : "bg-gray-200 dark:bg-white/10"
                    }`}
                    style={{ transform: "translateX(-50%)" }}
                  />
                )}

                {/* Step circle */}
                <div
                  className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-500 ${
                    isComplete
                      ? "bg-green-500 text-white scale-100"
                      : isCurrent
                      ? "bg-[#DC2626] text-white scale-110 shadow-lg shadow-[#DC2626]/30"
                      : "bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 scale-90"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <step.Icon className="w-3.5 h-3.5" />
                  )}
                  {/* Pulse ring on current step */}
                  {isCurrent && (
                    <span className="absolute inset-0 rounded-full border-2 border-[#DC2626] animate-ping opacity-30" />
                  )}
                </div>

                {/* Label */}
                <p
                  className={`mt-1.5 text-[10px] text-center leading-tight transition-all duration-300 ${
                    isCurrent
                      ? "text-[#DC2626] font-bold"
                      : isComplete
                      ? "text-green-600 dark:text-green-400 font-medium"
                      : isPending
                      ? "text-gray-300 dark:text-gray-600"
                      : "text-gray-500"
                  }`}
                >
                  {step.shortLabel}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
