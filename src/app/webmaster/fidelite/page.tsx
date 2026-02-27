// /webmaster/fidelite — Loyalty program settings
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Trophy,
  Gift,
  Users,
  TrendingUp,
  Save,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type Tier = {
  minOrders: number;
  rewardType: "FIXED" | "PERCENT";
  rewardCents?: number;
  rewardPercent?: number;
  label: string;
};

type Stats = {
  totalRewards: number;
  usedRewards: number;
  activeRewards: number;
  fideleCount: number;
  totalDiscountCents: number;
  conversionRate: number;
};

export default function FidelitePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/webmaster/loyalty");
      if (res.ok) {
        const json = await res.json();
        setIsActive(json.data.program.isActive);
        setTiers(json.data.program.tiers || []);
        setStats(json.data.stats);
      }
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/webmaster/loyalty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive, tiers }),
      });
      if (res.ok) {
        toast.success("Programme de fidélité mis à jour");
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  }

  function addTier() {
    const maxOrders = tiers.length > 0 ? Math.max(...tiers.map((t) => t.minOrders)) : 0;
    setTiers([
      ...tiers,
      {
        minOrders: maxOrders + 5,
        rewardType: "FIXED",
        rewardCents: 500,
        label: `${maxOrders + 5} commandes → -5€`,
      },
    ]);
  }

  function removeTier(index: number) {
    setTiers(tiers.filter((_, i) => i !== index));
  }

  function updateTier(index: number, updates: Partial<Tier>) {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, ...updates } : t)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy size={22} className="text-amber-500" />
            Programme de fidélité
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gérez les paliers et récompenses automatiques
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-[#b91c1c] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Bons générés"
            value={stats.totalRewards}
            icon={<Gift size={18} className="text-purple-500" />}
          />
          <StatCard
            label="Bons utilisés"
            value={stats.usedRewards}
            sub={`${stats.conversionRate}% conversion`}
            icon={<TrendingUp size={18} className="text-emerald-500" />}
          />
          <StatCard
            label="Bons actifs"
            value={stats.activeRewards}
            icon={<Gift size={18} className="text-amber-500" />}
          />
          <StatCard
            label="Clients fidèles"
            value={stats.fideleCount}
            sub={`${(stats.totalDiscountCents / 100).toFixed(0)}€ distribués`}
            icon={<Users size={18} className="text-blue-500" />}
          />
        </div>
      )}

      {/* Toggle active */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              Programme actif
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Les bons seront automatiquement générés après chaque palier atteint
            </p>
          </div>
          <button
            onClick={() => setIsActive(!isActive)}
            className="text-primary"
          >
            {isActive ? (
              <ToggleRight size={36} className="text-emerald-500" />
            ) : (
              <ToggleLeft size={36} className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Tiers configuration */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Paliers de fidélité
          </h2>
          <button
            onClick={addTier}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-[#b91c1c] transition-colors"
          >
            <Plus size={14} />
            Ajouter un palier
          </button>
        </div>

        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl"
            >
              {/* Min orders */}
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Nb commandes
                </label>
                <input
                  type="number"
                  value={tier.minOrders}
                  onChange={(e) =>
                    updateTier(index, { minOrders: parseInt(e.target.value) || 1 })
                  }
                  min={1}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
                />
              </div>

              {/* Reward type */}
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Type
                </label>
                <select
                  value={tier.rewardType}
                  onChange={(e) =>
                    updateTier(index, {
                      rewardType: e.target.value as "FIXED" | "PERCENT",
                    })
                  }
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
                >
                  <option value="FIXED">Montant fixe (€)</option>
                  <option value="PERCENT">Pourcentage (%)</option>
                </select>
              </div>

              {/* Value */}
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {tier.rewardType === "FIXED" ? "Montant (€)" : "Pourcentage (%)"}
                </label>
                <input
                  type="number"
                  value={
                    tier.rewardType === "FIXED"
                      ? (tier.rewardCents || 0) / 100
                      : tier.rewardPercent || 0
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (tier.rewardType === "FIXED") {
                      updateTier(index, { rewardCents: Math.round(val * 100) });
                    } else {
                      updateTier(index, { rewardPercent: val });
                    }
                  }}
                  min={0}
                  step={tier.rewardType === "FIXED" ? 0.5 : 1}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
                />
              </div>

              {/* Label */}
              <div className="flex-[2] min-w-0">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Label
                </label>
                <input
                  type="text"
                  value={tier.label}
                  onChange={(e) => updateTier(index, { label: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => removeTier(index)}
                className="self-end sm:self-center p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {tiers.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              Aucun palier configuré. Ajoutez-en un pour activer le programme.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
