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
import { refusalMessage } from "@/lib/api/client-refusal";
import { shopPublication } from "@/lib/shop-publication";

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
  vacationMode: boolean;
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

import { ORDER_STATUS_COLORS } from "@/lib/design-tokens";

const SHOP_PHOTO_SAVE_FAILED = "La photo n'a pas pu être enregistrée.";

/** French reason of a refused shop photo save; an answer that is not JSON gets the generic one. */
async function shopPhotoSaveError(res: Response): Promise<string> {
  if (!res.headers.get("content-type")?.includes("application/json")) return SHOP_PHOTO_SAVE_FAILED;
  const body = (await res.json()) as {
    error?: { message?: string; details?: { imageUrl?: string[] } };
  };
  return body.error?.details?.imageUrl?.[0] ?? body.error?.message ?? SHOP_PHOTO_SAVE_FAILED;
}

// ── Component ──

export default function WebmasterShopDetailPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  // ── Actions ──

  async function handleValidate(approved: boolean) {
    setActionLoading("validate");
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (res.ok) await fetchShop();
      else toast.error(await refusalMessage(res));
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
    setActionLoading(null);
  }

  async function handleSuspend() {
    setActionLoading("suspend");
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspended: true,
          reason: suspendReason || "Suspendue par le webmaster",
        }),
      });
      if (res.ok) {
        setShowSuspendConfirm(false);
        setSuspendReason("");
        await fetchShop();
      } else toast.error(await refusalMessage(res));
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
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
      else toast.error(await refusalMessage(res));
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
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
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
    setActionLoading(null);
  }

  async function toggleField(field: "featured" | "visible") {
    if (!shop) return;
    const newVal = !shop[field];
    setShop((prev) => (prev ? { ...prev, [field]: newVal } : prev));
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newVal }),
      });
      if (!res.ok) {
        setShop((prev) => (prev ? { ...prev, [field]: !newVal } : prev));
        toast.error(await refusalMessage(res));
      }
    } catch {
      setShop((prev) => (prev ? { ...prev, [field]: !newVal } : prev));
      toast.error("Erreur de connexion au serveur");
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400">Boutique introuvable</p>
        <Link href="/webmaster/boutiques" className="mt-3 inline-block text-sm text-[#DC2626]">
          Retour aux boutiques
        </Link>
      </div>
    );
  }

  const isSuspended = !!shop.suspendedAt;
  const isNotValidated = shopPublication(shop) === "UNPUBLISHED";
  const avgOrder =
    shop.stats.completedOrders > 0
      ? Math.round(shop.stats.totalRevenue / shop.stats.completedOrders)
      : 0;

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      {/* Back + Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push("/webmaster/boutiques")}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#141414]"
        >
          <ArrowLeft size={16} className="text-gray-500 dark:text-gray-400" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-display text-xl font-bold text-gray-900 dark:text-white">
              {shop.name}
            </h1>
            {shop.visible && (
              <>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ACTIVE
                </span>
              </>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {shop.city} · {shop.address}
            {shop.owner && ` · ${shop.owner.name}`}
          </p>
        </div>

        {/* Quick toggles */}
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => toggleField("featured")}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              shop.featured
                ? "bg-amber-500/20 text-amber-600"
                : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
            }`}
            title={shop.featured ? "Retirer mise en avant" : "Mettre en avant"}
          >
            <Star size={16} fill={shop.featured ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => toggleField("visible")}
            disabled={isSuspended}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all disabled:pointer-events-none disabled:opacity-50 ${
              shop.visible ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"
            }`}
            title={shop.visible ? "Masquer" : "Rendre visible"}
          >
            {shop.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "general"
              ? "bg-white text-gray-900 shadow-sm dark:bg-[#141414] dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Général
        </button>
        <button
          onClick={() => setActiveTab("adjustments")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "adjustments"
              ? "bg-white text-gray-900 shadow-sm dark:bg-[#141414] dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Ajustements prix
        </button>
      </div>

      {/* Tab: Adjustments */}
      {activeTab === "adjustments" && <ShopAdjustmentsTab shopId={shopId} />}

      {/* Tab: General */}
      {activeTab === "general" && (
        <>
          {/* Not validated alert */}
          {isNotValidated && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Boutique non validée
                </span>
              </div>
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-300/80">
                Cette boutique n&apos;a pas encore été validée. Approuvez-la pour la rendre visible
                sur la plateforme.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleValidate(true)}
                  disabled={actionLoading === "validate"}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading === "validate" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  Approuver (Starter, 14j essai)
                </button>
                <button
                  onClick={() => handleValidate(false)}
                  disabled={actionLoading === "validate"}
                  className="flex items-center gap-1.5 rounded-xl bg-red-100 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                >
                  <XCircle size={12} /> Refuser
                </button>
              </div>
            </div>
          )}

          {/* Suspended alert */}
          {isSuspended && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
              <div className="mb-2 flex items-center gap-2">
                <PauseCircle size={16} className="text-red-500" />
                <span className="text-sm font-bold text-red-700 dark:text-red-400">
                  Boutique suspendue
                </span>
              </div>
              {shop.suspendReason && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400/80">
                  Raison&nbsp;: {shop.suspendReason}
                </p>
              )}
              <button
                onClick={handleReactivate}
                disabled={actionLoading === "reactivate"}
                className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading === "reactivate" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <PlayCircle size={12} />
                )}
                Réactiver la boutique
              </button>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                label: "CA total",
                value: centsToEuro(shop.stats.totalRevenue),
                icon: TrendingUp,
                color: "text-[#DC2626]",
                bg: "bg-[#DC2626]/10",
              },
              {
                label: "Commission",
                value: centsToEuro(shop.stats.totalCommission),
                icon: Coins,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-500/10",
              },
              {
                label: "Commandes",
                value: `${shop.stats.completedOrders} / ${shop.stats.orderCount}`,
                icon: ShoppingCart,
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-500/10",
              },
              {
                label: "Panier moyen",
                value: centsToEuro(avgOrder),
                icon: ShoppingCart,
                color: "text-purple-600 dark:text-purple-400",
                bg: "bg-purple-500/10",
              },
              {
                label: "Produits",
                value: String(shop.stats.productCount),
                icon: Package,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-500/10",
              },
              {
                label: "Avis",
                value: `${shop.stats.reviewCount} · ${shop.rating.toFixed(1)}★`,
                icon: MessageSquare,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-500/10",
              },
              {
                label: "Tickets",
                value: String(shop.stats.ticketCount),
                icon: Headphones,
                color: "text-gray-600 dark:text-gray-400",
                bg: "bg-gray-500/10",
              },
              {
                label: "Inscription",
                value: new Date(shop.createdAt).toLocaleDateString("fr-FR"),
                icon: CheckCircle2,
                color: "text-gray-600 dark:text-gray-400",
                bg: "bg-gray-500/10",
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-white/[0.06] dark:bg-[#141414]"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className={`h-7 w-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                      <Icon size={13} className={s.color} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {s.label}
                    </span>
                  </div>
                  <p className={`text-base font-extrabold ${s.color}`}>{s.value}</p>
                </div>
              );
            })}
          </div>

          {/* Admin actions row */}
          <div className="grid grid-cols-1 gap-4">
            {/* Commission + Suspend */}
            <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#141414]">
              {/* Commission */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Commission</h3>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={commissionPct}
                    onChange={(e) => {
                      setCommissionPct(parseFloat(e.target.value) || 0);
                      setCommissionDirty(true);
                    }}
                    className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                  {commissionDirty && (
                    <button
                      onClick={handleCommission}
                      disabled={actionLoading === "commission"}
                      className="rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:opacity-50"
                    >
                      {actionLoading === "commission" ? "..." : "Enregistrer"}
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                  {shop.commissionEnabled ? "Active" : "Désactivée"} · Total perçu :{" "}
                  {centsToEuro(shop.stats.totalCommission)}
                </p>
              </div>

              {/* Mode occupé — durée par défaut */}
              <div className="border-t border-gray-100 pt-4 dark:border-white/5">
                <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">
                  Mode occupé
                </h3>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  Durée par défaut quand le boucher active le mode occupé
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={shop.defaultBusyDurationMin ?? 15}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val))
                        setShop((prev) => (prev ? { ...prev, defaultBusyDurationMin: val } : prev));
                    }}
                    className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">minutes</span>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin/shops/${shopId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            defaultBusyDurationMin: shop.defaultBusyDurationMin ?? 15,
                          }),
                        });
                        if (res.ok) toast.success("Durée mise à jour");
                        else toast.error("Erreur");
                      } catch {
                        toast.error("Erreur de connexion");
                      }
                    }}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#b91c1c]"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>

              {/* Suspend / Reactivate */}
              <div className="border-t border-gray-100 pt-4 dark:border-white/5">
                <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">
                  {isSuspended ? "Boutique suspendue" : "Suspension"}
                </h3>
                {isSuspended ? (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading === "reactivate"}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading === "reactivate" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <PlayCircle size={12} />
                    )}
                    Réactiver
                  </button>
                ) : !showSuspendConfirm ? (
                  <button
                    onClick={() => setShowSuspendConfirm(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-red-100 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20"
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
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSuspend}
                        disabled={actionLoading === "suspend"}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        {actionLoading === "suspend" ? "..." : "Confirmer suspension"}
                      </button>
                      <button
                        onClick={() => {
                          setShowSuspendConfirm(false);
                          setSuspendReason("");
                        }}
                        className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
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
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#141414]">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Camera size={15} className="text-gray-500 dark:text-gray-400" /> Photo de la boutique
            </h3>

            {/* Current photo */}
            <div className="mb-4 flex items-center gap-4">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                {shop.imageUrl ? (
                  <Image
                    src={shop.imageUrl}
                    alt={shop.name}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
                    🏪
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {shop.imageUrl ? "Photo actuelle" : "Aucune photo"}
                </p>
                {shop.imageUrl && (
                  <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-gray-500 dark:text-gray-400">
                    {shop.imageUrl}
                  </p>
                )}
              </div>
            </div>

            {/* Default photos grid */}
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              Choisir une photo par defaut
            </p>
            <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
              {[1, 3, 4, 5, 6, 8, 10].map((n) => {
                const url = `/img/shops/shop-${n}.jpg`;
                const isActive = shop.imageUrl === url;
                return (
                  <button
                    key={n}
                    onClick={async () => {
                      const previousUrl = shop.imageUrl;
                      const restore = () =>
                        setShop((prev) => (prev ? { ...prev, imageUrl: previousUrl } : prev));
                      setShop((prev) => (prev ? { ...prev, imageUrl: url } : prev));
                      try {
                        const res = await fetch(`/api/shops/${shopId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ imageUrl: url }),
                        });
                        if (!res.ok) {
                          restore();
                          toast.error(await shopPhotoSaveError(res));
                        }
                      } catch {
                        restore();
                        toast.error("Erreur de connexion au serveur");
                      }
                    }}
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                      isActive
                        ? "border-[#DC2626] ring-2 ring-[#DC2626]/20"
                        : "border-transparent hover:border-gray-300 dark:hover:border-white/20"
                    }`}
                  >
                    <Image src={url} alt={`Photo ${n}`} fill className="object-cover" />
                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#DC2626]/20">
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
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#141414]">
              <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">Proprietaire</h3>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Nom
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {shop.owner.name}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Email
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{shop.owner.email}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Telephone
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {shop.owner.phone || "Non renseigne"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Recent orders */}
          {shop.recentOrders.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#141414]">
              <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">
                Dernieres commandes
              </h3>
              <div className="space-y-2">
                {shop.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between border-b border-gray-50 py-2 last:border-0 dark:border-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${ORDER_STATUS_COLORS[order.status] || ""}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {centsToEuro(order.totalCents)}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
