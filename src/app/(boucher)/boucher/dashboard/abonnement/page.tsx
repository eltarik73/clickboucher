// src/app/(boucher)/boucher/dashboard/abonnement/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Loader2, Crown, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

type SubInfo = {
  plan: string;
  status: string;
  billingCycle: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysLeft: number | null;
};

const PLANS = [
  {
    key: "STARTER",
    name: "Starter",
    icon: Zap,
    monthlyPrice: 49,
    yearlyPrice: 470,
    features: {
      products: "Jusqu'à 50 produits",
      orders: "Commandes illimitées",
      dashboard: "Tableau de bord basique",
      stats: "Stats basiques",
      support: "Support email",
      chat: false,
      loyalty: false,
      advanced_stats: false,
      priority_support: false,
      auto_promos: false,
    },
  },
  {
    key: "PRO",
    name: "Pro",
    icon: Sparkles,
    monthlyPrice: 99,
    yearlyPrice: 950,
    popular: true,
    features: {
      products: "Produits illimités",
      orders: "Commandes illimitées",
      dashboard: "Tableau de bord complet",
      stats: "Stats avancées",
      support: "Support prioritaire",
      chat: true,
      loyalty: false,
      advanced_stats: true,
      priority_support: true,
      auto_promos: false,
    },
    upsell: "Les bouchers Pro font en moyenne +35% de CA grâce au Chat IA",
  },
  {
    key: "PREMIUM",
    name: "Premium",
    icon: Crown,
    monthlyPrice: 149,
    yearlyPrice: 1430,
    features: {
      products: "Produits illimités",
      orders: "Commandes illimitées",
      dashboard: "Tableau de bord complet",
      stats: "Stats avancées + Rapports",
      support: "Support dédié 24/7",
      chat: true,
      loyalty: true,
      advanced_stats: true,
      priority_support: true,
      auto_promos: true,
    },
  },
];

const FEATURE_LABELS: Record<string, string> = {
  chat: "Chat IA client",
  loyalty: "Programme fidélité",
  advanced_stats: "Statistiques avancées",
  priority_support: "Support prioritaire",
  auto_promos: "Promos auto heures creuses",
};

export default function AbonnementPage() {
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearly, setYearly] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/boucher/subscription")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setSub(json.data);
          setYearly(json.data.billingCycle === "yearly");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planKey: string) => {
    setUpgrading(planKey);
    try {
      const res = await fetch("/api/boucher/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, billingCycle: yearly ? "yearly" : "monthly" }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Formule ${planKey} activée !`);
        setSub(json.data);
      } else {
        toast.error(json.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#DC2626]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/boucher/dashboard"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
          >
            <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mon abonnement</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {/* Current plan status */}
        {sub && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Formule actuelle</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{sub.plan}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                sub.status === "TRIAL" ? "bg-amber-100 text-amber-700" :
                sub.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                "bg-red-100 text-red-700"
              }`}>
                {sub.status === "TRIAL" ? "Essai gratuit" : sub.status === "ACTIVE" ? "Actif" : sub.status}
              </span>
            </div>
            {sub.status === "TRIAL" && sub.daysLeft !== null && (
              <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  🎁 Essai gratuit — <span className="font-bold">{sub.daysLeft} jour{sub.daysLeft > 1 ? "s" : ""}</span> restant{sub.daysLeft > 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm ${!yearly ? "font-bold text-gray-900 dark:text-white" : "text-gray-500"}`}>Mensuel</span>
          <button
            onClick={() => setYearly(!yearly)}
            className={`relative w-14 h-7 rounded-full transition-colors ${yearly ? "bg-[#DC2626]" : "bg-gray-300 dark:bg-gray-600"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${yearly ? "translate-x-7" : ""}`} />
          </button>
          <span className={`text-sm ${yearly ? "font-bold text-gray-900 dark:text-white" : "text-gray-500"}`}>
            Annuel <span className="text-[#DC2626] font-bold">-20%</span>
          </span>
        </div>

        {/* Plans grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = sub?.plan === plan.key;
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            const originalYearly = plan.monthlyPrice * 12;
            const savings = yearly ? originalYearly - plan.yearlyPrice : 0;

            return (
              <div
                key={plan.key}
                className={`bg-white dark:bg-[#141414] rounded-2xl border-2 p-5 relative ${
                  plan.popular ? "border-[#DC2626]" : isCurrent ? "border-green-500" : "border-[#ece8e3] dark:border-white/10"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#DC2626] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    POPULAIRE
                  </span>
                )}

                <plan.icon className={`w-6 h-6 mb-2 ${plan.popular ? "text-[#DC2626]" : "text-gray-400"}`} />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>

                <div className="mt-2">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    {yearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice}&euro;
                  </span>
                  <span className="text-xs text-gray-500">/mois</span>
                </div>

                {yearly && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {price}&euro;/an <span className="text-[#DC2626] font-bold">(économie {savings}&euro;)</span>
                  </p>
                )}

                {/* Features */}
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{plan.features.products}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{plan.features.stats}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{plan.features.support}</p>
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      {plan.features[key as keyof typeof plan.features] ? (
                        <Check size={12} className="text-green-500" />
                      ) : (
                        <X size={12} className="text-gray-300" />
                      )}
                      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Upsell */}
                {"upsell" in plan && plan.upsell && !isCurrent && (
                  <p className="text-[10px] text-[#DC2626] mt-3 italic">{plan.upsell}</p>
                )}

                {/* Action button */}
                <button
                  onClick={() => !isCurrent && handleUpgrade(plan.key)}
                  disabled={isCurrent || !!upgrading}
                  className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isCurrent
                      ? "bg-green-100 text-green-700 cursor-default"
                      : "bg-[#DC2626] text-white hover:bg-[#b91c1c] disabled:opacity-50"
                  }`}
                >
                  {isCurrent ? "Formule actuelle" : upgrading === plan.key ? "..." : `Passer en ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
