"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Star,
  Eye,
  EyeOff,
  ShoppingCart,
  Package,
  MessageSquare,
  Headphones,
  TrendingUp,
  Coins,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  Camera,
  Check,
} from "lucide-react";
import Image from "next/image";
import ShopAdjustmentsTab from "@/components/webmaster/ShopAdjustmentsTab";

// ── Types ──

type ShopDetail = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  email: string | null;
  imageUrl: string | null;
  status: string;
  visible: boolean;
  featured: boolean;
  rating: number;
  ratingCount: number;
  commissionPct: number;
  commissionEnabled: boolean;
  defaultBusyDurationMin: number;
  createdAt: string;
  legalName: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  subscription: {
    id: string;
    plan: string;
    status: string;
    trialEndsAt: string | null;
    validatedAt: string | null;
    adminNote: string | null;
  } | null;
  owner: { name: string; email: string; phone: string | null } | null;
  stats: {
    totalRevenue: number;
    totalCommission: number;
    completedOrders: number;
    productCount: number;
    orderCount: number;
    reviewCount: number;
    ticketCount: number;
  };
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    createdAt: string;
  }[];
};

// ── Helpers ──

function centsToEuro(c: number) {
  return (c / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

import { ORDER_STATUS_COLORS, PLAN_COLORS, SUB_STATUS_COLORS } from "@/lib/design-tokens";

// ── Component ──

export default function WebmasterShopDetailPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Plan change state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");

  // Commission state
  const [commissionPct, setCommissionPct] = useState(0);
  const [commissionDirty, setCommissionDirty] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"general" | "adjustments">("general");

  // Suspend reason
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setShop(json.data);
          setCommissionPct(json.data.commissionPct || 0);
        }
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { fetchShop(); }, [fetchShop]);

  // ── Actions ──

  async function handleValidate(approved: boolean) {
    setActionLoading("validate");
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, plan: "STARTER", trialDays: 14 }),
      });
      if (res.ok) await fetchShop();
      else toast.error("Erreur");
    } catch { toast.error("Erreur de connexion au serveur"); }
    setActionLoading(null);
  }

  async function handleSuspend() {
    setActionLoading("suspend");
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: true, reason: suspendReason || "Suspendue par le webmaster" }),
      });
      if (res.ok) {
        setShowSuspendConfirm(false);
        setSuspendReason("");
        await fetchShop();
      } else toast.error("Erreur");
    } catch { toast.error("Erreur de connexion au serveur"); }
    setActionLoading(null);
  }

  async function handleReactivate() {
    setActionLoading("reactivate");
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: false }),
      });
      if (res.ok) await fetchShop();
      else toast.error("Erreur");
    } catch { toast.error("Erreur de connexion au serveur"); }
    setActionLoading(null);
  }

  async function handleChangePlan() {
    if (!selectedPlan) return;
    setActionLoading("plan");
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      if (res.ok) {
        setShowPlanModal(false);
        await fetchShop();
      } else toast.error("Erreur");
    } catch { toast.error("Erreur de connexion au serveur"); }
    setActionLoading(null);
  }

  async function handleCommission() {
    setActionLoading("commission");
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/commission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionPct, commissionEnabled: commissionPct > 0 }),
      });
      if (res.ok) {
        setCommissionDirty(false);
        await fetchShop();
      } else toast.error("Erreur");
    } catch { toast.error("Erreur de connexion au serveur"); }
    setActionLoading(null);
  }

  async function toggleField(field: "featured" | "visible") {
    if (!shop) return;
    const newVal = !shop[field];
    setShop((prev) => prev ? { ...prev, [field]: newVal } : prev);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newVal }),
      });
      if (!res.ok) setShop((prev) => prev ? { ...prev, [field]: !newVal } : prev);
    } catch {
      setShop((prev) => prev ? { ...prev, [field]: !newVal } : prev);
      toast.error("Erreur de connexion au serveur");
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Boutique introuvable</p>
        <Link href="/webmaster/boutiques" className="text-sm text-[#DC2626] mt-3 inline-block">
          Retour aux boutiques
        </Link>
      </div>
    );
  }

  const isSuspended = shop.subscription?.status === "SUSPENDED";
  const isNotValidated = !shop.subscription?.validatedAt && !shop.visible;
  const avgOrder = shop.stats.completedOrders > 0
    ? Math.round(shop.stats.totalRevenue / shop.stats.completedOrders)
    : 0;

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Back + Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push("/webmaster/boutiques")}
          className="w-9 h-9 rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0 mt-0.5"
        >
          <ArrowLeft size={16} className="text-gray-500 dark:text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white truncate">
              {shop.name}
            </h1>
            {shop.subscription && (
              <>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${PLAN_COLORS[shop.subscription.plan] || ""}`}>
                  {shop.subscription.plan}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${SUB_STATUS_COLORS[shop.subscription.status] || ""}`}>
                  {shop.subscription.status}
                </span>
              </>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {shop.city} · {shop.address}
            {shop.owner && ` · ${shop.owner.name}`}
          </p>
        </div>

        {/* Quick toggles */}
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => toggleField("featured")}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              shop.featured
                ? "bg-amber-500/20 text-amber-600"
                : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
            }`}
            title={shop.featured ? "Retirer mise en avant" : "Mettre en avant"}
          >
            <Star size={16} fill={shop.featured ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => toggleField("visible")}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              shop.visible
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-500"
            }`}
            title={shop.visible ? "Masquer" : "Rendre visible"}
          >
            {shop.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "general"
              ? "bg-white dark:bg-[#141414] text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Général
        </button>
        <button
          onClick={() => setActiveTab("adjustments")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "adjustments"
              ? "bg-white dark:bg-[#141414] text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Ajustements prix
        </button>
      </div>

      {/* Tab: Adjustments */}
      {activeTab === "adjustments" && (
        <ShopAdjustmentsTab shopId={shopId} />
      )}

      {/* Tab: General */}
      {activeTab === "general" && (<>

      {/* Not validated alert */}
      {isNotValidated && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Boutique non validée</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300/80 mb-3">
            Cette boutique n&apos;a pas encore été validée. Approuvez-la pour la rendre visible sur la plateforme.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleValidate(true)}
              disabled={actionLoading === "validate"}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {actionLoading === "validate" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Approuver (Starter, 14j essai)
            </button>
            <button
              onClick={() => handleValidate(false)}
              disabled={actionLoading === "validate"}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <XCircle size={12} /> Refuser
            </button>
          </div>
        </div>
      )}

      {/* Suspended alert */}
      {isSuspended && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PauseCircle size={16} className="text-red-500" />
            <span className="text-sm font-bold text-red-700 dark:text-red-400">Boutique suspendue</span>
          </div>
          {shop.subscription?.adminNote && (
            <p className="text-xs text-red-600 dark:text-red-400/80 mb-3">Raison: {shop.subscription.adminNote}</p>
          )}
          <button
            onClick={handleReactivate}
            disabled={actionLoading === "reactivate"}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {actionLoading === "reactivate" ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
            Reactiver la boutique
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "CA total", value: centsToEuro(shop.stats.totalRevenue), icon: TrendingUp, color: "text-[#DC2626]", bg: "bg-[#DC2626]/10" },
          { label: "Commission", value: centsToEuro(shop.stats.totalCommission), icon: Coins, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { label: "Commandes", value: `${shop.stats.completedOrders} / ${shop.stats.orderCount}`, icon: ShoppingCart, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
          { label: "Panier moyen", value: centsToEuro(avgOrder), icon: ShoppingCart, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
          { label: "Produits", value: String(shop.stats.productCount), icon: Package, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Avis", value: `${shop.stats.reviewCount} · ${shop.rating.toFixed(1)}★`, icon: MessageSquare, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { label: "Tickets", value: String(shop.stats.ticketCount), icon: Headphones, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-500/10" },
          { label: "Inscription", value: new Date(shop.createdAt).toLocaleDateString("fr-FR"), icon: CheckCircle2, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-500/10" },
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

      {/* Admin actions row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subscription / Plan management */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Abonnement</h3>

          {shop.subscription ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Plan actuel</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${PLAN_COLORS[shop.subscription.plan] || ""}`}>
                  {shop.subscription.plan}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Statut</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${SUB_STATUS_COLORS[shop.subscription.status] || ""}`}>
                  {shop.subscription.status}
                </span>
              </div>
              {shop.subscription.trialEndsAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Fin essai</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {new Date(shop.subscription.trialEndsAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              )}
              {shop.subscription.adminNote && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">Note: {shop.subscription.adminNote}</p>
              )}

              {/* Change plan */}
              {!showPlanModal ? (
                <button
                  onClick={() => { setSelectedPlan(shop.subscription!.plan); setShowPlanModal(true); }}
                  className="w-full mt-2 px-3 py-2 text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 rounded-xl hover:bg-[#DC2626]/20 transition-colors"
                >
                  Changer de plan
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    {["STARTER", "PRO", "PREMIUM"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedPlan(p)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                          selectedPlan === p
                            ? "bg-[#DC2626] text-white"
                            : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleChangePlan}
                      disabled={actionLoading === "plan" || selectedPlan === shop.subscription.plan}
                      className="flex-1 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-lg disabled:opacity-50 hover:bg-[#b91c1c] transition-colors"
                    >
                      {actionLoading === "plan" ? "..." : "Confirmer"}
                    </button>
                    <button
                      onClick={() => setShowPlanModal(false)}
                      className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">Aucun abonnement</p>
          )}
        </div>

        {/* Commission + Suspend */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5 space-y-5">
          {/* Commission */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Commission</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionPct}
                onChange={(e) => { setCommissionPct(parseFloat(e.target.value) || 0); setCommissionDirty(true); }}
                className="w-20 px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-center text-gray-900 dark:text-white"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
              {commissionDirty && (
                <button
                  onClick={handleCommission}
                  disabled={actionLoading === "commission"}
                  className="px-3 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-lg hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
                >
                  {actionLoading === "commission" ? "..." : "Enregistrer"}
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
              {shop.commissionEnabled ? "Active" : "Désactivée"} · Total perçu : {centsToEuro(shop.stats.totalCommission)}
            </p>
          </div>

          {/* Mode occupé — durée par défaut */}
          <div className="border-t border-gray-100 dark:border-white/5 pt-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Mode occupé</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Durée par défaut quand le boucher active le mode occupé</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={5}
                max={120}
                value={shop.defaultBusyDurationMin ?? 15}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setShop((prev) => prev ? { ...prev, defaultBusyDurationMin: val } : prev);
                }}
                className="w-20 px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white text-center"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">minutes</span>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/shops/${shopId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ defaultBusyDurationMin: shop.defaultBusyDurationMin ?? 15 }),
                    });
                    if (res.ok) toast.success("Durée mise à jour");
                    else toast.error("Erreur");
                  } catch { toast.error("Erreur de connexion"); }
                }}
                className="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-[#b91c1c] transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>

          {/* Suspend / Reactivate */}
          <div className="border-t border-gray-100 dark:border-white/5 pt-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              {isSuspended ? "Boutique suspendue" : "Suspension"}
            </h3>
            {isSuspended ? (
              <button
                onClick={handleReactivate}
                disabled={actionLoading === "reactivate"}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === "reactivate" ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                Reactiver
              </button>
            ) : !showSuspendConfirm ? (
              <button
                onClick={() => setShowSuspendConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors"
              >
                <PauseCircle size={12} /> Suspendre cette boutique
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Raison de la suspension..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSuspend}
                    disabled={actionLoading === "suspend"}
                    className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === "suspend" ? "..." : "Confirmer suspension"}
                  </button>
                  <button
                    onClick={() => { setShowSuspendConfirm(false); setSuspendReason(""); }}
                    className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shop photo management */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Camera size={15} className="text-gray-500 dark:text-gray-400" /> Photo de la boutique
        </h3>

        {/* Current photo */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
            {shop.imageUrl ? (
              <Image src={shop.imageUrl} alt={shop.name} width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🏪</div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {shop.imageUrl ? "Photo actuelle" : "Aucune photo"}
            </p>
            {shop.imageUrl && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[200px]">{shop.imageUrl}</p>
            )}
          </div>
        </div>

        {/* Default photos grid */}
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          Choisir une photo par defaut
        </p>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {[1, 3, 4, 5, 6, 8, 10].map((n) => {
            const url = `/img/shops/shop-${n}.jpg`;
            const isActive = shop.imageUrl === url;
            return (
              <button
                key={n}
                onClick={async () => {
                  setShop((prev) => prev ? { ...prev, imageUrl: url } : prev);
                  try {
                    await fetch(`/api/shops/${shopId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageUrl: url }),
                    });
                  } catch { toast.error("Erreur de connexion au serveur"); }
                }}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  isActive
                    ? "border-[#DC2626] ring-2 ring-[#DC2626]/20"
                    : "border-transparent hover:border-gray-300 dark:hover:border-white/20"
                }`}
              >
                <Image src={url} alt={`Photo ${n}`} fill className="object-cover" />
                {isActive && (
                  <div className="absolute inset-0 bg-[#DC2626]/20 flex items-center justify-center">
                    <Check size={18} className="text-white drop-shadow" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Owner info */}
      {shop.owner && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Proprietaire</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Nom</span>
              <span className="text-gray-900 dark:text-white font-medium">{shop.owner.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Email</span>
              <span className="text-gray-700 dark:text-gray-300">{shop.owner.email}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Telephone</span>
              <span className="text-gray-700 dark:text-gray-300">{shop.owner.phone || "Non renseigne"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent orders */}
      {shop.recentOrders.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Dernieres commandes</h3>
          <div className="space-y-2">
            {shop.recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/[0.03] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{order.orderNumber}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${ORDER_STATUS_COLORS[order.status] || ""}`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {centsToEuro(order.totalCents)}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}
