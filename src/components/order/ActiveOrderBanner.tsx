// src/components/order/ActiveOrderBanner.tsx — Floating mini-tracker for active orders
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Clock, ChefHat, Package, ChevronRight } from "lucide-react";

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  shopName: string;
  estimatedReady: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  PENDING:    { label: "En attente",      icon: Clock,   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  ACCEPTED:   { label: "Acceptée",        icon: Clock,   color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  PREPARING:  { label: "En préparation",  icon: ChefHat, color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-900/20" },
  READY:      { label: "Prête !",         icon: Package, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
};

export function ActiveOrderBanner() {
  const { isSignedIn } = useUser();
  const [order, setOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    async function fetchActive() {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) return;
        const json = await res.json();
        const orders = json.data || json || [];
        // Find the most recent non-terminal order
        const active = orders.find((o: { status: string }) =>
          ["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(o.status)
        );
        if (active) {
          setOrder({
            id: active.id,
            orderNumber: active.orderNumber,
            status: active.status,
            shopName: active.shop?.name || "",
            estimatedReady: active.estimatedReady || null,
          });
        }
      } catch {}
    }

    fetchActive();
    const iv = setInterval(fetchActive, 30_000);
    return () => clearInterval(iv);
  }, [isSignedIn]);

  if (!order) return null;

  const config = STATUS_CONFIG[order.status];
  if (!config) return null;

  const Icon = config.icon;

  const timeLeft = order.estimatedReady
    ? (() => {
        const diff = new Date(order.estimatedReady).getTime() - Date.now();
        if (diff <= 0) return "Imminent";
        const min = Math.ceil(diff / 60_000);
        return `~${min} min`;
      })()
    : null;

  return (
    <Link
      href={`/suivi/${order.id}`}
      className={`block mx-4 mb-4 rounded-2xl border border-gray-200/60 dark:border-white/10 ${config.bg} overflow-hidden shadow-sm hover:shadow-md transition-all`}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Animated icon */}
        <div className={`w-10 h-10 rounded-xl ${config.color} bg-white dark:bg-[#141414] border border-gray-200/60 dark:border-white/10 flex items-center justify-center shrink-0`}>
          <Icon size={18} className={order.status === "PREPARING" ? "animate-pulse" : ""} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold ${config.color}`}>
              {config.label}
            </p>
            {order.status === "READY" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {order.shopName} · #{order.orderNumber}
            {timeLeft && ` · ${timeLeft}`}
          </p>
        </div>

        {/* Arrow */}
        <ChevronRight size={18} className="text-gray-400 shrink-0" />
      </div>

      {/* Mini progress bar */}
      <div className="h-1 bg-gray-200/50 dark:bg-white/5">
        <div
          className="h-full bg-[#DC2626] transition-all duration-700"
          style={{
            width: order.status === "PENDING" ? "15%"
              : order.status === "ACCEPTED" ? "40%"
              : order.status === "PREPARING" ? "65%"
              : order.status === "READY" ? "90%"
              : "100%",
          }}
        />
      </div>
    </Link>
  );
}
