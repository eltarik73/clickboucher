// src/components/order/ReorderSection.tsx — "Commander à nouveau" single card for homepage
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { RotateCcw, ChevronRight } from "lucide-react";

interface LastOrder {
  shopName: string;
  shopSlug: string;
  summary: string;
  totalCents: number;
  createdAt: string;
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

export function ReorderSection() {
  const { isSignedIn } = useUser();
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    (async () => {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data || json || [];

        for (const o of data) {
          if (!["COMPLETED", "PICKED_UP"].includes(o.status)) continue;
          const items = o.items || [];
          const names = items.slice(0, 3).map((i: { name: string }) => i.name);
          const summary = names.join(", ") + (items.length > 3 ? ` +${items.length - 3}` : "");

          setLastOrder({
            shopName: o.shop?.name || "",
            shopSlug: o.shop?.slug || "",
            summary,
            totalCents: o.totalCents,
            createdAt: o.createdAt,
          });
          break;
        }
      } catch {}
    })();
  }, [isSignedIn]);

  if (!lastOrder) return null;

  return (
    <section className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-[#DC2626] rounded-full" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
          Commander à nouveau
        </h3>
      </div>
      <Link
        href={`/boutique/${lastOrder.shopSlug}`}
        className="flex items-center gap-3 bg-white dark:bg-white/[0.03] rounded-2xl p-4 border border-[#ece8e3] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all group"
      >
        <div className="w-11 h-11 rounded-xl bg-[#DC2626]/10 flex items-center justify-center shrink-0">
          <RotateCcw size={18} className="text-[#DC2626]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-[#DC2626] transition-colors">
            {lastOrder.shopName}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {lastOrder.summary} · {timeAgo(lastOrder.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[#DC2626] text-sm font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">
          {(lastOrder.totalCents / 100).toFixed(2).replace(".", ",")} €
          <ChevronRight size={16} />
        </div>
      </Link>
    </section>
  );
}
