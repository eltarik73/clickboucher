"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Store,
  Star,
  Package,
  ShoppingBag,
  CreditCard,
  DollarSign,
  MessageSquare,
  Check,
  X,
  Ban,
  Play,
  Crown,
} from "lucide-react";

type ShopDetail = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  status: string;
  visible: boolean;
  rating: number;
  ratingCount: number;
  commissionPct: number;
  commissionEnabled: boolean;
  createdAt: string;
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: string | null;
    validatedAt: string | null;
  } | null;
  owner: {
    name: string;
    email: string;
    phone: string | null;
  } | null;
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

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function planBadge(plan: string) {
  const colors: Record<string, string> = {
    STARTER: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
    PRO: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    PREMIUM: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[plan] || colors.STARTER}`}>
      {plan}
    </span>
  );
}

function subStatusBadge(status: string) {
  const m: Record<string, { label: string; cls: string }> = {
    TRIAL: { label: "Essai", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
    ACTIVE: { label: "Actif", cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
    SUSPENDED: { label: "Suspendu", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
    CANCELLED: { label: "Annulé", cls: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-400" },
    PENDING: { label: "En attente", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" },
    EXPIRED: { label: "Expiré", cls: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-400" },
  };
  const s = m[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export default function AdminShopDetailPage({ params }: { params: { shopId: string } }) {
  const { shopId } = params;
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`);
      const json = await res.json();
      setShop(json.data || json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [shopId]);

  async function handleValidate(approved: boolean) {
    setActing(true);
    await fetch(`/api/admin/shops/${shopId}/validate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, plan: "STARTER", trialDays: 14 }),
    });
    await load();
    setActing(false);
  }

  async function handleSuspend(suspended: boolean) {
    setActing(true);
    await fetch(`/api/admin/shops/${shopId}/suspend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended }),
    });
    await load();
    setActing(false);
  }

  async function handlePlanChange(plan: string) {
    setActing(true);
    await fetch(`/api/admin/shops/${shopId}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    await load();
    setActing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="text-center py-32">
        <p className="text-gray-500">Boutique introuvable</p>
        <Link href="/admin/shops" className="text-[#DC2626] text-sm mt-2 inline-block">
          ← Retour aux boucheries
        </Link>
      </div>
    );
  }

  const statCards = [
    { label: "Revenus", value: fmt(shop.stats.totalRevenue) + " €", icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Commission", value: fmt(shop.stats.totalCommission) + " €", icon: CreditCard, color: "text-purple-600 dark:text-purple-400" },
    { label: "Commandes", value: shop.stats.completedOrders.toString(), icon: Package, color: "text-blue-600 dark:text-blue-400" },
    { label: "Produits", value: shop.stats.productCount.toString(), icon: ShoppingBag, color: "text-amber-600 dark:text-amber-400" },
    { label: "Avis", value: shop.stats.reviewCount.toString(), icon: Star, color: "text-yellow-600 dark:text-yellow-400" },
    { label: "Tickets", value: shop.stats.ticketCount.toString(), icon: MessageSquare, color: "text-sky-600 dark:text-sky-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/shops"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#DC2626] transition-colors"
      >
        <ArrowLeft size={16} />
        Retour aux boucheries
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
              {shop.name}
            </h1>
            {shop.subscription && planBadge(shop.subscription.plan)}
            {shop.subscription && subStatusBadge(shop.subscription.status)}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {shop.address}, {shop.city} &middot; {shop.phone}
          </p>
          {shop.owner && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Propriétaire : {shop.owner.name} ({shop.owner.email})
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!shop.visible && (
            <button
              onClick={() => handleValidate(true)}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Check size={14} /> Valider
            </button>
          )}
          {shop.visible && shop.subscription?.status !== "SUSPENDED" && (
            <button
              onClick={() => handleSuspend(true)}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Ban size={14} /> Suspendre
            </button>
          )}
          {shop.subscription?.status === "SUSPENDED" && (
            <button
              onClick={() => handleSuspend(false)}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Play size={14} /> Réactiver
            </button>
          )}
          {shop.subscription && (
            <div className="flex items-center gap-1">
              <Crown size={14} className="text-amber-500" />
              {(["STARTER", "PRO", "PREMIUM"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePlanChange(p)}
                  disabled={acting || shop.subscription?.plan === p}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    shop.subscription?.plan === p
                      ? "bg-[#DC2626] text-white"
                      : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15"
                  } disabled:opacity-50`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-4 shadow-sm text-center">
              <Icon size={20} className={`mx-auto mb-2 ${s.color}`} />
              <p className="text-lg font-bold text-gray-900 dark:text-[#f8f6f3]">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Info cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Shop info */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3] mb-4 flex items-center gap-2">
            <Store size={16} /> Informations
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Statut</dt>
              <dd className="text-gray-900 dark:text-[#f8f6f3] font-medium">{shop.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Visible</dt>
              <dd className="text-gray-900 dark:text-[#f8f6f3] font-medium">{shop.visible ? "Oui" : "Non"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Note</dt>
              <dd className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Star size={12} fill="currentColor" /> {shop.rating.toFixed(1)} ({shop.ratingCount})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Commission</dt>
              <dd className="text-gray-900 dark:text-[#f8f6f3] font-medium">
                {shop.commissionPct}% {shop.commissionEnabled ? "(activée)" : "(désactivée)"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Inscrit le</dt>
              <dd className="text-gray-900 dark:text-[#f8f6f3]">
                {new Date(shop.createdAt).toLocaleDateString("fr-FR")}
              </dd>
            </div>
          </dl>
        </div>

        {/* Recent orders */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
            <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
              Dernières commandes
            </h2>
          </div>
          {shop.recentOrders.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Aucune commande
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {shop.recentOrders.map((o) => (
                <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3]">
                      #{o.orderNumber}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3]">
                      {fmt(o.totalCents)} €
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      o.status === "COMPLETED" || o.status === "PICKED_UP"
                        ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                        : o.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
                          : o.status === "CANCELLED" || o.status === "DENIED"
                            ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
