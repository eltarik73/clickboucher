// src/app/(boucher)/boucher/parametres/paiement/page.tsx
// Page onboarding Stripe Connect boucher.
// - Affiche statut Stripe (créé / en cours / actif / restreint)
// - Boutons : démarrer/reprendre onboarding, ouvrir dashboard Stripe, rafraîchir
// - Affiche détail du palier de commission appliqué
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  CreditCard,
  Info,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ShopTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

type StripeShopInfo = {
  id: string;
  name: string;
  email: string | null;
  stripeAccountId: string | null;
  stripeAccountStatus: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  tier: ShopTier;
  earlyAdopterUntil: string | null;
};

type StatusDetails = {
  accountId: string;
  status: "active" | "pending" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
};

// ─────────────────────────────────────────────
// Tier metadata
// ─────────────────────────────────────────────
const TIER_INFO: Record<
  ShopTier,
  { label: string; rate: number; color: string; emoji: string; bg: string }
> = {
  BRONZE: { label: "Bronze", rate: 8, color: "text-amber-700 dark:text-amber-400", emoji: "🥉", bg: "bg-amber-50 dark:bg-amber-950/30" },
  SILVER: { label: "Argent", rate: 7, color: "text-gray-600 dark:text-gray-300", emoji: "🥈", bg: "bg-gray-50 dark:bg-gray-900/40" },
  GOLD: { label: "Or", rate: 6, color: "text-yellow-700 dark:text-yellow-400", emoji: "🥇", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
  PLATINUM: { label: "Platine", rate: 5, color: "text-cyan-700 dark:text-cyan-400", emoji: "💎", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function PaiementOnboardingPage() {
  const searchParams = useSearchParams();
  const [shop, setShop] = useState<StripeShopInfo | null>(null);
  const [status, setStatus] = useState<StatusDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [opening, setOpening] = useState(false);

  // ── Fetch shop ──
  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch("/api/shops/my-shop");
      if (!res.ok) {
        toast.error("Impossible de charger la boutique");
        return;
      }
      const json = await res.json();
      const data = json.data;
      setShop({
        id: data.id,
        name: data.name,
        email: data.email,
        stripeAccountId: data.stripeAccountId ?? null,
        stripeAccountStatus: data.stripeAccountStatus ?? null,
        stripeChargesEnabled: data.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: data.stripePayoutsEnabled ?? false,
        tier: (data.tier as ShopTier) ?? "BRONZE",
        earlyAdopterUntil: data.earlyAdopterUntil ?? null,
      });
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Refresh status (manual + auto on return from Stripe) ──
  const refreshStatus = useCallback(
    async (silent = false) => {
      setRefreshing(true);
      try {
        const res = await fetch("/api/boucher/stripe/refresh-status", {
          method: "POST",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (!silent) toast.error(json.error?.message || "Erreur");
          return;
        }
        const json = await res.json();
        setStatus(json.data);
        // Re-pull shop to get updated stripeChargesEnabled etc.
        await fetchShop();
        if (!silent) toast.success("Statut rafraîchi");
      } catch {
        if (!silent) toast.error("Erreur de connexion");
      } finally {
        setRefreshing(false);
      }
    },
    [fetchShop]
  );

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  // ── Auto-refresh on ?stripe=return ──
  useEffect(() => {
    const stripeReturn = searchParams.get("stripe");
    if (stripeReturn === "return" && shop?.stripeAccountId) {
      refreshStatus(true);
    }
  }, [searchParams, shop?.stripeAccountId, refreshStatus]);

  // ── Démarrer onboarding ──
  async function startOnboarding() {
    setOnboarding(true);
    try {
      const res = await fetch("/api/boucher/stripe/onboard");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error?.message || "Impossible de démarrer l'onboarding");
        setOnboarding(false);
        return;
      }
      const json = await res.json();
      if (json.data?.url) {
        window.location.href = json.data.url;
      } else {
        toast.error("URL d'onboarding manquante");
        setOnboarding(false);
      }
    } catch {
      toast.error("Erreur de connexion");
      setOnboarding(false);
    }
  }

  // ── Ouvrir dashboard Stripe ──
  async function openDashboard() {
    setOpening(true);
    try {
      const res = await fetch("/api/boucher/stripe/dashboard-link");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error?.message || "Impossible d'ouvrir le dashboard");
        return;
      }
      const json = await res.json();
      if (json.data?.url) {
        window.open(json.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("URL dashboard manquante");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setOpening(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Boutique introuvable</p>
      </div>
    );
  }

  // ── Computed states ──
  const hasAccount = !!shop.stripeAccountId;
  const isActive = shop.stripeChargesEnabled && shop.stripePayoutsEnabled;
  const isRestricted = shop.stripeAccountStatus === "restricted";
  const isPending = hasAccount && !isActive && !isRestricted;
  const tierInfo = TIER_INFO[shop.tier];
  const isEarlyAdopter =
    shop.earlyAdopterUntil && new Date(shop.earlyAdopterUntil) > new Date();
  const effectiveRate = isEarlyAdopter
    ? Math.max(5, tierInfo.rate - 2)
    : tierInfo.rate;
  const payoutPct = 100 - effectiveRate;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DC2626]/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Paiement en ligne
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Connectez votre compte Stripe pour encaisser
            </p>
          </div>
        </div>

        {/* ── Status Card ── */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-4">
            {/* Status badge */}
            {isActive ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    Compte Stripe actif
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Tu peux encaisser des paiements en ligne. Versements hebdomadaires automatiques le lundi.
                  </p>
                </div>
              </div>
            ) : isRestricted ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Compte restreint
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                    Stripe a bloqué ton compte. Reprends l&apos;onboarding ou ouvre ton dashboard pour vérifier les actions requises.
                  </p>
                </div>
              </div>
            ) : isPending ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-spin" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Onboarding en cours
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Reprends ton onboarding Stripe pour finaliser la vérification d&apos;identité (KYC) et activer les paiements.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                    Pas encore connecté
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    Active les paiements en ligne pour encaisser via Klik&Go. Tes clients pourront payer par carte au moment de la commande.
                  </p>
                </div>
              </div>
            )}

            {/* Email check */}
            {!shop.email && !hasAccount && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Email de la boutique requis avant l&apos;onboarding. Renseigne-le dans
                  <span className="font-semibold"> Paramètres → Informations boutique</span>.
                </p>
              </div>
            )}

            {/* Status details (if loaded) */}
            {status && (status.requirementsCurrentlyDue.length > 0 || status.requirementsPastDue.length > 0) && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">
                  Étapes à compléter
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5 list-disc list-inside">
                  {status.requirementsCurrentlyDue.slice(0, 5).map((req) => (
                    <li key={req}>{translateRequirement(req)}</li>
                  ))}
                  {status.requirementsPastDue.slice(0, 5).map((req) => (
                    <li key={req} className="text-red-700 dark:text-red-400 font-medium">
                      {translateRequirement(req)} (en retard)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-2">
              {!hasAccount && (
                <Button
                  onClick={startOnboarding}
                  disabled={onboarding || !shop.email}
                  className="flex-1 bg-[#DC2626] hover:bg-[#b91c1c] text-white h-11 rounded-xl"
                >
                  {onboarding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Activer les paiements en ligne
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}

              {hasAccount && !isActive && (
                <Button
                  onClick={startOnboarding}
                  disabled={onboarding}
                  className="flex-1 bg-[#DC2626] hover:bg-[#b91c1c] text-white h-11 rounded-xl"
                >
                  {onboarding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Reprendre l&apos;onboarding
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}

              {hasAccount && isActive && (
                <Button
                  onClick={openDashboard}
                  disabled={opening}
                  className="flex-1 bg-gray-900 dark:bg-white dark:text-gray-900 text-white h-11 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100"
                >
                  {opening ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Voir mon dashboard Stripe
                    </>
                  )}
                </Button>
              )}

              {hasAccount && (
                <Button
                  onClick={() => refreshStatus(false)}
                  disabled={refreshing}
                  variant="outline"
                  className="h-11 rounded-xl"
                >
                  {refreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Rafraîchir</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Tier / Commission Card ── */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#DC2626]" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Ton palier de commission
              </h2>
            </div>

            <div className={`rounded-2xl p-4 ${tierInfo.bg}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{tierInfo.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-lg font-bold ${tierInfo.color}`}>
                    Palier {tierInfo.label}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Commission Klik&Go : <span className="font-semibold">{effectiveRate}%</span>
                    {isEarlyAdopter && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                        <Sparkles className="w-2.5 h-2.5" />
                        EARLY ADOPTER −2 pts
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  Tu reçois {payoutPct}% de chaque commande
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  + 0,99 € de frais de service plateforme par commande, payés par le client.
                </p>
              </div>
            </div>

            {/* Info paliers */}
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Comment progresser ?
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Ton palier est recalculé automatiquement chaque mois selon ton CA HT. Plus tu vends, moins tu paies de commission.
              </p>
              <ul className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5 mt-1">
                <li>🥉 Bronze : 0 – 2 000 € / mois → 8%</li>
                <li>🥈 Argent : 2 000 – 5 000 € / mois → 7%</li>
                <li>🥇 Or : 5 000 – 10 000 € / mois → 6%</li>
                <li>💎 Platine : &gt; 10 000 € / mois → 5%</li>
              </ul>
            </div>

            <a
              href="/cgu#commissions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#DC2626] hover:underline"
            >
              Voir les CGU complètes
              <ExternalLink className="w-3 h-3" />
            </a>
          </CardContent>
        </Card>

        {/* ── How it works ── */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Comment fonctionne le paiement
            </h2>
            <ol className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <li className="flex gap-2">
                <span className="font-bold text-[#DC2626] shrink-0">1.</span>
                <span>Le client paie par carte au moment de la commande sur Klik&Go.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#DC2626] shrink-0">2.</span>
                <span>Stripe transfère automatiquement ta part (CA – commission) sur ton compte Stripe.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#DC2626] shrink-0">3.</span>
                <span>Versement bancaire chaque lundi sur le compte que tu auras renseigné.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#DC2626] shrink-0">4.</span>
                <span>Toutes les factures Stripe et fiscales sont disponibles dans ton dashboard Stripe.</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function translateRequirement(key: string): string {
  const map: Record<string, string> = {
    "individual.verification.document": "Pièce d'identité à fournir",
    "individual.verification.additional_document": "Document complémentaire à fournir",
    "individual.address.line1": "Adresse personnelle à compléter",
    "individual.email": "Adresse e-mail à confirmer",
    "individual.phone": "Numéro de téléphone à confirmer",
    "external_account": "Compte bancaire de versement à renseigner",
    "tos_acceptance.date": "Conditions Stripe à accepter",
    "business_profile.url": "Site web à renseigner",
    "business_profile.product_description": "Description d'activité à renseigner",
  };
  return map[key] || key;
}
