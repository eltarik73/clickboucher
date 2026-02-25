"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

type AdminStats = {
  totalRevenue: number;
  totalOrders: number;
  totalShops: number;
  totalUsers: number;
  totalCommissionCents: number;
  ordersLast7Days: { date: string; orders: number }[];
};

function centsToEuro(c: number) {
  return (c / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default function WebmasterStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) setStats(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-center text-gray-400 py-12">Impossible de charger les statistiques</p>;
  }

  const weekData = stats.ordersLast7Days || [];
  const maxVal = Math.max(...weekData.map((d) => d.orders), 1);
  const totalWeek = weekData.reduce((s, d) => s + d.orders, 0);

  const SUMMARY = [
    { label: "CA total", value: centsToEuro(stats.totalRevenue), color: "text-[#DC2626]" },
    { label: "Commandes", value: String(stats.totalOrders), color: "text-blue-600 dark:text-blue-400" },
    { label: "Boucheries", value: String(stats.totalShops), color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Clients", value: String(stats.totalUsers), color: "text-purple-600 dark:text-purple-400" },
    { label: "Commission", value: centsToEuro(stats.totalCommissionCents), color: "text-amber-600 dark:text-amber-400" },
    { label: "Sem. en cours", value: String(totalWeek), color: "text-gray-900 dark:text-white" },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {SUMMARY.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#141414] rounded-xl border border-stone-200 dark:border-white/10 shadow-sm p-4 text-center"
          >
            <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {weekData.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-[20px] border border-stone-200 dark:border-white/10 shadow-sm p-6">
          <h3 className="font-display text-lg font-bold text-gray-900 dark:text-[#f8f6f3]">
            Commandes cette semaine
          </h3>
          <div className="mt-5 flex items-end gap-2 h-[150px]">
            {weekData.map((d, i) => {
              const dayLabel = new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" });
              const isMax = d.orders === maxVal;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-stone-500 dark:text-gray-400">
                    {d.orders}
                  </span>
                  <div
                    className={`w-full rounded-t-lg animate-fade-up ${
                      isMax ? "bg-[#DC2626]" : "bg-stone-200 dark:bg-white/10"
                    }`}
                    style={{
                      height: `${Math.max((d.orders / maxVal) * 110, 4)}px`,
                      animationDelay: `${i * 70}ms`,
                    } as React.CSSProperties}
                  />
                  <span className="text-[9px] text-stone-400 dark:text-gray-500 capitalize">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
