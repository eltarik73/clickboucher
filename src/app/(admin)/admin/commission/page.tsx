"use client";

import { useEffect, useState } from "react";
import { CreditCard, DollarSign, Save } from "lucide-react";

type ShopCommission = {
  id: string;
  name: string;
  commissionPct: number;
  commissionEnabled: boolean;
};

type CommissionData = {
  shops: ShopCommission[];
  totalCommissionCents: number;
  monthlyCommissionCents: number;
};

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminCommissionPage() {
  const [data, setData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Global settings
  const [globalPct, setGlobalPct] = useState(5);
  const [applyingGlobal, setApplyingGlobal] = useState(false);

  // Per-shop edits (shopId -> pct)
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [savingShop, setSavingShop] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/commission");
      const json = await res.json();
      setData(json.data || json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function applyGlobal() {
    setApplyingGlobal(true);
    await fetch("/api/admin/commission/global", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPct: globalPct, commissionEnabled: true }),
    });
    await load();
    setEdits({});
    setApplyingGlobal(false);
  }

  async function saveShopCommission(shopId: string) {
    const pct = edits[shopId];
    if (pct === undefined) return;
    setSavingShop(shopId);
    await fetch(`/api/admin/shops/${shopId}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPct: pct, commissionEnabled: true }),
    });
    await load();
    setEdits((prev) => {
      const next = { ...prev };
      delete next[shopId];
      return next;
    });
    setSavingShop(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
          Commission
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gérez les taux de commission par boucherie
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10">
              <CreditCard size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Commission totale</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            {fmt(data.totalCommissionCents)} €
          </p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Commission ce mois</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            {fmt(data.monthlyCommissionCents)} €
          </p>
        </div>
      </div>

      {/* Global commission */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3] mb-4">
          Commission globale
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Taux (%)
            </label>
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={globalPct}
              onChange={(e) => setGlobalPct(parseFloat(e.target.value))}
              className="w-full accent-[#DC2626]"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span className="font-semibold text-gray-900 dark:text-[#f8f6f3] text-sm">
                {globalPct}%
              </span>
              <span>30%</span>
            </div>
          </div>
          <button
            onClick={applyGlobal}
            disabled={applyingGlobal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
          >
            {applyingGlobal ? "Application..." : "Appliquer à toutes"}
          </button>
        </div>
      </div>

      {/* Per-shop commission */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
            Commission par boucherie
          </h2>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-white/5">
          {data.shops.map((shop) => {
            const currentPct = edits[shop.id] ?? shop.commissionPct;
            const hasEdit = edits[shop.id] !== undefined;
            return (
              <div key={shop.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3] truncate">
                    {shop.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {shop.commissionEnabled ? "Activée" : "Désactivée"} — {shop.commissionPct}% actuel
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="0.5"
                    value={currentPct}
                    onChange={(e) =>
                      setEdits((prev) => ({ ...prev, [shop.id]: parseFloat(e.target.value) }))
                    }
                    className="w-32 accent-[#DC2626]"
                  />
                  <span className="w-12 text-center text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                    {currentPct}%
                  </span>
                  {hasEdit && (
                    <button
                      onClick={() => saveShopCommission(shop.id)}
                      disabled={savingShop === shop.id}
                      className="p-2 rounded-lg bg-[#DC2626] text-white hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
                    >
                      <Save size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {data.shops.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Aucune boucherie visible
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
