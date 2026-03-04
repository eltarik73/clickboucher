// src/components/order/OrderTracker.tsx — Dismissible order tracker for homepage (Uber Eats style)
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
    <div className="relative bg-gradient-to-br from-[#DC2626] to-red-700 rounded-2xl p-3.5 px-4 shadow-lg shadow-red-600/20">
      <button
        onClick={(e) => { e.preventDefault(); setDismissed(true); }}
        className="absolute top-2.5 right-2.5 bg-white/15 rounded-full w-6 h-6 flex items-center justify-center text-white hover:bg-white/25 transition"
        aria-label="Fermer le suivi"
      >
        <X size={12} />
      </button>

      <Link href={`/suivi/${order.id}`} className="block">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="bg-white/20 rounded-xl w-9 h-9 flex items-center justify-center">
            <Package size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">
              {order.status === "PENDING" ? "Commande envoyée" : "Commande en cours"}
            </div>
            <div className="text-white/70 text-xs truncate">
              {order.shopName} · #{order.orderNumber}
            </div>
          </div>
          {timeLeft && (
            <div className="flex items-center gap-1 text-white font-bold text-[13px] shrink-0">
              <Timer size={14} />
              {timeLeft}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {STEPS.map((step, i) => (
            <div key={step} className="flex-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${
                  i <= currentStep ? "bg-white" : "bg-white/25"
                }`}
              />
              <div
                className={`text-[10px] mt-1 text-center ${
                  i <= currentStep ? "text-white font-semibold" : "text-white/40"
                }`}
              >
                {step}
              </div>
            </div>
          ))}
        </div>
      </Link>
    </div>
  );
}
