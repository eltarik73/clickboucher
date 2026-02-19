// src/components/order/ReorderCarousel.tsx — "Commander à nouveau" horizontal carousel
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { RotateCcw, ChevronRight, ShoppingBag } from "lucide-react";

interface PastOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
  shopName: string;
  shopSlug: string;
  itemCount: number;
  firstItems: string[];
  createdAt: string;
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export function ReorderCarousel() {
  const { isSignedIn } = useUser();
  const [orders, setOrders] = useState<PastOrder[]>([]);

  useEffect(() => {
    if (!isSignedIn) return;

    (async () => {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data || json || [];

        // Filter completed orders, deduplicate by shop, take last 6
        const seen = new Set<string>();
        const pastOrders: PastOrder[] = [];

        for (const o of data) {
          if (!["COMPLETED", "PICKED_UP"].includes(o.status)) continue;
          const shopKey = o.shop?.slug || o.shopId;
          if (seen.has(shopKey)) continue;
          seen.add(shopKey);

          const items = o.items || [];
          pastOrders.push({
            id: o.id,
            orderNumber: o.orderNumber,
            totalCents: o.totalCents,
            shopName: o.shop?.name || "",
            shopSlug: o.shop?.slug || "",
            itemCount: items.length,
            firstItems: items.slice(0, 3).map((i: { name: string }) => i.name),
            createdAt: o.createdAt,
          });

          if (pastOrders.length >= 6) break;
        }

        setOrders(pastOrders);
      } catch {}
    })();
  }, [isSignedIn]);

  if (orders.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-[#DC2626] rounded-full" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
          Commander a nouveau
        </h3>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/boutique/${order.shopSlug}`}
            className="group min-w-[240px] shrink-0 bg-white dark:bg-white/[0.03] rounded-xl border border-[#ece8e3] dark:border-white/[0.06] p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#DC2626]/10 flex items-center justify-center">
                <RotateCcw size={16} className="text-[#DC2626]" />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {timeAgo(order.createdAt)}
              </span>
            </div>

            <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-[#DC2626] transition-colors">
              {order.shopName}
            </h4>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
              {order.firstItems.join(", ")}
              {order.itemCount > 3 && ` +${order.itemCount - 3}`}
            </p>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {fmtPrice(order.totalCents)}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-[#DC2626] group-hover:translate-x-0.5 transition-transform">
                <ShoppingBag size={12} />
                Recommander
                <ChevronRight size={12} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
