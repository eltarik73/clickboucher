"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  AlertTriangle,
  Star,
  RefreshCw,
  Store,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

interface ShopPerf {
  id: string;
  name: string;
  slug: string;
  city: string;
  imageUrl: string | null;
  status: string;
  rating: number;
  ratingCount: number;
  cachedAcceptanceRate: number | null;
  cachedAvgPrepMinutes: number | null;
  cachedCancelRate: number | null;
  cachedResponseMinutes: number | null;
  cachedLateRate: number | null;
  cachedAvgRating: number | null;
  performanceScore: number | null;
  metricsUpdatedAt: string | null;
  _count: { alerts: number };
}

function pct(v: number | null) {
  return v !== null ? `${Math.round(v * 100)}%` : "—";
}

function scoreColor(score: number | null) {
  if (score === null) return "text-gray-400";
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number | null) {
  if (score === null) return "bg-gray-100 dark:bg-white/10";
  if (score >= 80) return "bg-green-50 dark:bg-green-500/10";
  if (score >= 60) return "bg-amber-50 dark:bg-amber-500/10";
  if (score >= 40) return "bg-orange-50 dark:bg-orange-500/10";
  return "bg-red-50 dark:bg-red-500/10";
}

export default function PerformanceOverviewPage() {
  const [shops, setShops] = useState<ShopPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/webmaster/performance");
      if (res.ok) {
        const json = await res.json();
        setShops(json.data || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  async function recalculate(shopId: string) {
    await fetch(`/api/webmaster/performance/${shopId}`, { method: "POST" });
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            Performance des boutiques
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Vue globale des métriques de performance (30 derniers jours)
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">{shops.length}</p>
          <p className="text-xs text-gray-400 mt-1">Boutiques</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {shops.filter((s) => (s.performanceScore ?? 0) >= 80).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Score 80+</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {shops.filter((s) => (s.performanceScore ?? 0) >= 40 && (s.performanceScore ?? 0) < 80).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Score 40-79</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">
            {shops.reduce((sum, s) => sum + s._count.alerts, 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Alertes actives</p>
        </div>
      </div>

      {/* Shop table */}
      {shops.length === 0 ? (
        <div className="text-center py-12">
          <Store size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Aucune boutique visible</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Boutique</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Accept.</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Annul.</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Réponse</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Retard</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase">Note</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase">Alertes</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/10 overflow-hidden flex-shrink-0">
                          {shop.imageUrl ? (
                            <Image src={shop.imageUrl} alt="" width={36} height={36} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Store size={16} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-[#f8f6f3]">{shop.name}</p>
                          <p className="text-xs text-gray-400">{shop.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold ${scoreBg(shop.performanceScore)} ${scoreColor(shop.performanceScore)}`}>
                        {shop.performanceScore ?? "—"}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3 hidden md:table-cell text-gray-600 dark:text-gray-400">
                      {pct(shop.cachedAcceptanceRate)}
                    </td>
                    <td className="text-center px-3 py-3 hidden md:table-cell text-gray-600 dark:text-gray-400">
                      {pct(shop.cachedCancelRate)}
                    </td>
                    <td className="text-center px-3 py-3 hidden lg:table-cell text-gray-600 dark:text-gray-400">
                      {shop.cachedResponseMinutes !== null ? `${Math.round(shop.cachedResponseMinutes)}m` : "—"}
                    </td>
                    <td className="text-center px-3 py-3 hidden lg:table-cell text-gray-600 dark:text-gray-400">
                      {pct(shop.cachedLateRate)}
                    </td>
                    <td className="text-center px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {shop.cachedAvgRating !== null ? shop.cachedAvgRating.toFixed(1) : shop.rating.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      {shop._count.alerts > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
                          <AlertTriangle size={12} />
                          {shop._count.alerts}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => recalculate(shop.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors"
                        title="Recalculer"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
