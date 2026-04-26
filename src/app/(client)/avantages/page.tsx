// src/app/(client)/avantages/page.tsx — Client loyalty & promo advantages page
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Trophy,
  Gift,
  Copy,
  Check,
  Clock,
  ChevronRight,
  Loader2,
  Tag,
  Star,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

type LoyaltyStatus = {
  totalOrders: number;
  currentTier: number;
  badge: string | null;
  nextTier: { minOrders: number; remaining: number; label: string } | null;
  rewards: {
    id: string;
    code: string;
    tier: number;
    rewardType: string;
    rewardCents: number | null;
    rewardPercent: number | null;
    expiresAt: string;
  }[];
  tiers: {
    minOrders: number;
    rewardType: string;
    rewardCents?: number;
    rewardPercent?: number;
    label: string;
    reached: boolean;
  }[];
};

type ActivePromo = {
  id: string;
  type: string;
  valueCents: number | null;
  valuePercent: number | null;
  label: string;
  code: string | null;
  minOrderCents: number | null;
  endsAt: string;
};

function formatEuro(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function daysLeft(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return "Expiré";
  if (diff === 1) return "Expire demain";
  return `Expire dans ${diff}j`;
}

function rewardValueLabel(r: { rewardType: string; rewardCents: number | null; rewardPercent: number | null }) {
  if (r.rewardType === "AMOUNT" && r.rewardCents) return `-${formatEuro(r.rewardCents)}`;
  if (r.rewardType === "PERCENT" && r.rewardPercent) return `-${r.rewardPercent}%`;
  return "Récompense";
}

export default function AvantagesPage() {
  const [loyalty, setLoyalty] = useState<LoyaltyStatus | null>(null);
  const [promos] = useState<ActivePromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const loyaltyRes = await fetch("/api/loyalty/status");
      if (loyaltyRes.ok) {
        const json = await loyaltyRes.json();
        setLoyalty(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.success("Code copié !");
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  const progressPct = loyalty?.nextTier
    ? Math.round(((loyalty.totalOrders % (loyalty.nextTier.minOrders)) / loyalty.nextTier.minOrders) * 100)
    : 100;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft size={18} className="text-gray-700 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy size={24} className="text-red-600" />
            Mes avantages
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Programme de fidélité et promotions</p>
        </div>
      </div>

      {/* Loyalty progress */}
      {loyalty && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Star size={18} className="text-amber-500" />
              Fidélité Klik&Go
              {loyalty.badge === "FIDELE" && (
                <span className="text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                  Client fidèle
                </span>
              )}
            </h2>
            <span className="text-sm font-bold text-red-600">{loyalty.totalOrders} commande{loyalty.totalOrders > 1 ? "s" : ""}</span>
          </div>

          {/* Progress bar */}
          {loyalty.nextTier ? (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>{loyalty.totalOrders} / {loyalty.nextTier.minOrders} commandes</span>
                <span>Plus que {loyalty.nextTier.remaining} !</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{loyalty.nextTier.label}</p>
            </div>
          ) : (
            <p className="text-sm text-green-600 font-medium mb-3">Tous les paliers atteints !</p>
          )}

          {/* Tiers */}
          <div className="space-y-2">
            {loyalty.tiers.map((tier) => (
              <div
                key={tier.minOrders}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                  tier.reached
                    ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20"
                    : "bg-gray-50 dark:bg-white/5"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  tier.reached ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                }`}>
                  {tier.reached ? <Check size={16} /> : tier.minOrders}
                </div>
                <span className="flex-1 text-sm font-medium">{tier.label}</span>
                {tier.reached && <span className="text-xs text-green-600 dark:text-green-400 font-bold">Débloqué</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available rewards */}
      {loyalty && loyalty.rewards.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5">
          <h2 className="font-bold flex items-center gap-2 mb-3">
            <Gift size={18} className="text-red-600" />
            Mes bons ({loyalty.rewards.length})
          </h2>
          <div className="space-y-3">
            {loyalty.rewards.map((r) => {
              const expDays = daysLeft(r.expiresAt);
              const isExpiringSoon = new Date(r.expiresAt).getTime() - Date.now() < 3 * 86_400_000;
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isExpiringSoon
                      ? "border-amber-300 dark:border-amber-600/30 bg-amber-50/50 dark:bg-amber-900/10"
                      : "border-gray-200 dark:border-white/10"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                    <span className="text-lg font-black text-red-600">{rewardValueLabel(r)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-sm">{r.code}</p>
                    <p className={`text-xs ${isExpiringSoon ? "text-amber-600 dark:text-amber-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                      <Clock size={10} className="inline mr-1" />{expDays}
                    </p>
                  </div>
                  <button
                    onClick={() => copyCode(r.code)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10"
                  >
                    {copiedCode === r.code ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-500 dark:text-gray-400" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active platform promos */}
      {promos.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5">
          <h2 className="font-bold flex items-center gap-2 mb-3">
            <Tag size={18} className="text-red-600" />
            Offres en cours
          </h2>
          <div className="space-y-3">
            {promos.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-white/10">
                <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center">
                  <span className="text-sm font-black text-white">
                    {p.type === "PERCENT" ? `-${p.valuePercent}%` : p.type === "AMOUNT" ? `-${formatEuro(p.valueCents || 0)}` : "GRATUIT"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {p.code ? `Code : ${p.code}` : "Appliquée automatiquement"}
                    {p.minOrderCents ? ` · Min. ${formatEuro(p.minOrderCents)}` : ""}
                  </p>
                </div>
                {p.code && (
                  <button
                    onClick={() => copyCode(p.code!)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10"
                  >
                    {copiedCode === p.code ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-500 dark:text-gray-400" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <Link
        href="/"
        className="block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-2xl transition-colors"
      >
        Commander maintenant <ChevronRight size={16} className="inline ml-1" />
      </Link>
    </div>
  );
}
