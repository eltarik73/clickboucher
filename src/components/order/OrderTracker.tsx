// src/components/order/OrderTracker.tsx — Glass effect order tracker for homepage
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Package, Timer, X } from "lucide-react";

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  shopName: string;
  estimatedReady: string | null;
}

const STEPS = ["Acceptée", "En préparation", "Prête"];

function getStepIndex(status: string): number {
  switch (status) {
    case "PENDING": return -1;
    case "ACCEPTED": return 0;
    case "PREPARING": return 1;
    case "READY": return 2;
    default: return -1;
  }
}

export function OrderTracker() {
  const { isSignedIn } = useUser();
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) return;
      const json = await res.json();
      const orders = json.data || json || [];
      const active = orders.find((o: { status: string }) =>
        ["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(o.status)
      );
      if (active) {
        const newOrder: ActiveOrder = {
          id: active.id,
          orderNumber: active.orderNumber,
          status: active.status,
          shopName: active.shop?.name || "",
          estimatedReady: active.estimatedReady || null,
        };
        if (prevStatus && newOrder.status !== prevStatus) {
          setDismissed(false);
        }
        setPrevStatus(newOrder.status);
        setOrder(newOrder);
      } else {
        setOrder(null);
      }
    } catch {}
  }, [prevStatus]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchActive();
    const iv = setInterval(fetchActive, 30_000);
    return () => clearInterval(iv);
  }, [isSignedIn, fetchActive]);

  if (!order || dismissed) return null;

  const currentStep = getStepIndex(order.status);

  const timeLeft = order.estimatedReady
    ? (() => {
        const diff = new Date(order.estimatedReady).getTime() - Date.now();
        if (diff <= 0) return "Imminent";
        const min = Math.ceil(diff / 60_000);
        return `~${min} min`;
      })()
    : null;

  return (
    <div className="rounded-2xl relative overflow-hidden shadow-[0_8px_32px_rgba(220,38,38,0.25)]">
      {/* Layer 1: gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-red-600 to-red-700" />

      {/* Layer 2: glass shine */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.18] via-white/[0.05] to-transparent pointer-events-none" />

      {/* Layer 3: top light line */}
      <div className="absolute top-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-4">
        <Link href={`/suivi/${order.id}`} className="block">
          {/* Row 1: icon + text + ETA + dismiss */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.18] backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Package size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-[15px]">
                {order.status === "PENDING" ? "Commande envoyée" : "Commande en cours"}
              </div>
              <div className="text-white/65 text-xs truncate">
                {order.shopName} · #{order.orderNumber}
              </div>
            </div>
            {timeLeft && (
              <div className="flex items-center gap-1 text-white font-bold text-[13px] flex-shrink-0">
                <Timer size={14} />
                <span>{timeLeft}</span>
              </div>
            )}
            <button
              onClick={(e) => { e.preventDefault(); setDismissed(true); }}
              className="w-7 h-7 rounded-full bg-white/[0.12] backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition flex-shrink-0 ml-1"
              aria-label="Fermer le suivi"
            >
              <X size={12} />
            </button>
          </div>

          {/* Progress bar — thin segments */}
          <div className="flex gap-1.5 mb-1.5">
            {STEPS.map((step, i) => (
              <div key={step} className={`flex-1 h-[3px] rounded-full ${i <= currentStep ? "bg-white" : "bg-white/20"} transition-all duration-500`} />
            ))}
          </div>

          {/* Labels under bar */}
          <div className="flex justify-between">
            {STEPS.map((step, i) => (
              <span key={step} className={`text-[11px] ${i <= currentStep ? "text-white font-semibold" : "text-white/35"}`}>
                {step}
              </span>
            ))}
          </div>
        </Link>
      </div>
    </div>
  );
}
