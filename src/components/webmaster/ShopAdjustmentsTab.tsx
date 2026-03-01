"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  ArrowUpDown,
  Scale,
} from "lucide-react";

type Adjustment = {
  id: string;
  orderNumber: string;
  adjustmentType: string;
  originalTotal: number;
  newTotal: number;
  tier: number;
  status: string;
  reason: string | null;
  createdAt: string;
  respondedAt: string | null;
};

type Stats = {
  total: number;
  accepted: number;
  rejected: number;
  escalated: number;
  pending: number;
  avgVariancePct: number;
  acceptanceRate: number;
  totalOrders: number;
  adjustmentRate: number;
};

function centsToEuro(c: number) {
  return (c / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  AUTO_APPROVED: { label: "Auto-approuvé", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  APPROVED: { label: "Accepté", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  AUTO_VALIDATED: { label: "Auto-validé", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  REJECTED: { label: "Refusé", color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" },
  ESCALATED: { label: "Escaladé", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400" },
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  2: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
  3: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
};

export default function ShopAdjustmentsTab({ shopId }: { shopId: string }) {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/adjustments`);
      const d = await res.json();
      if (d.success) {
        setAdjustments(d.data.adjustments);
        setStats(d.data.stats);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [shopId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="text-sm text-gray-400 text-center py-12">
        Impossible de charger les ajustements.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Alert: high adjustment rate */}
      {stats.adjustmentRate > 30 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Taux d&apos;ajustement élevé ({stats.adjustmentRate}%)
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
              Plus de 30% des commandes de cette boutique ont fait l&apos;objet d&apos;un ajustement de prix. Cela peut indiquer un problème de catalogue.
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Total", value: String(stats.total), icon: Scale, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-500/10" },
          { label: "Acceptés", value: String(stats.accepted), icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Refusés", value: String(stats.rejected), icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
          { label: "Escaladés", value: String(stats.escalated), icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
          { label: "Taux acceptation", value: `${stats.acceptanceRate}%`, icon: TrendingUp, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
          { label: "Variance moyenne", value: `${stats.avgVariancePct}%`, icon: ArrowUpDown, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon size={13} className={s.color} />
                </div>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</span>
              </div>
              <p className={`text-base font-extrabold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Adjustments table */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock size={14} /> Derniers ajustements
          </h3>
        </div>

        {adjustments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Aucun ajustement pour cette boutique.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02]">
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Commande</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Ancien</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Nouveau</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Ecart</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400">Palier</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400">Statut</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj) => {
                  const diffPct = adj.originalTotal > 0
                    ? ((adj.newTotal - adj.originalTotal) / adj.originalTotal * 100).toFixed(1)
                    : "0";
                  const isIncrease = adj.newTotal > adj.originalTotal;
                  const statusInfo = STATUS_LABELS[adj.status] || { label: adj.status, color: "bg-gray-100 text-gray-600" };
                  const tierColor = TIER_COLORS[adj.tier] || "";

                  return (
                    <tr key={adj.id} className="border-t border-gray-50 dark:border-white/[0.03] hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">{adj.orderNumber}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 capitalize">{adj.adjustmentType.toLowerCase()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{centsToEuro(adj.originalTotal)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{centsToEuro(adj.newTotal)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${isIncrease ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {isIncrease ? "+" : ""}{diffPct}%
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${tierColor}`}>
                          P{adj.tier}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-400">
                        {new Date(adj.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
