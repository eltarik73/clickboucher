"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import ShopModerationHeader from "./ShopModerationHeader";

type ShopDetail = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  status: string;
  visible: boolean;
  featured: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  vacationMode: boolean;
  rating: number;
  ratingCount: number;
  commissionPct: number;
  commissionEnabled: boolean;
  createdAt: string;
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

export default function AdminShopDetailPage({ params }: { params: { shopId: string } }) {
  const { shopId } = params;
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`);
      const json = await res.json();
      setShop(json.data || json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DC2626] border-t-transparent" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="py-32 text-center">
        <p className="text-gray-500 dark:text-gray-400">Boutique introuvable</p>
        <Link href="/admin/shops" className="mt-2 inline-block text-sm text-[#DC2626]">
          ← Retour aux boucheries
        </Link>
      </div>
    );
  }

  const statCards = [
    {
      label: "Revenus",
      value: fmt(shop.stats.totalRevenue) + " €",
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Commission",
      value: fmt(shop.stats.totalCommission) + " €",
      icon: CreditCard,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Commandes",
      value: shop.stats.completedOrders.toString(),
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Produits",
      value: shop.stats.productCount.toString(),
      icon: ShoppingBag,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Avis",
      value: shop.stats.reviewCount.toString(),
      icon: Star,
      color: "text-yellow-600 dark:text-yellow-400",
    },
    {
      label: "Tickets",
      value: shop.stats.ticketCount.toString(),
      icon: MessageSquare,
      color: "text-sky-600 dark:text-sky-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/shops"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-[#DC2626] dark:text-gray-400"
      >
        <ArrowLeft size={16} />
        Retour aux boucheries
      </Link>

      <ShopModerationHeader shop={shop} onChanged={load} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-white/10 dark:bg-[#141414]"
            >
              <Icon size={20} className={`mx-auto mb-2 ${s.color}`} />
              <p className="text-lg font-bold text-gray-900 dark:text-[#f8f6f3]">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Shop info */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#141414]">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-[#f8f6f3]">
            <Store size={16} /> Informations
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Statut</dt>
              <dd className="font-medium text-gray-900 dark:text-[#f8f6f3]">{shop.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Visible</dt>
              <dd className="font-medium text-gray-900 dark:text-[#f8f6f3]">
                {shop.visible ? "Oui" : "Non"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Note</dt>
              <dd className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <Star size={12} fill="currentColor" /> {shop.rating.toFixed(1)} ({shop.ratingCount})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Commission</dt>
              <dd className="font-medium text-gray-900 dark:text-[#f8f6f3]">
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
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
            <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">Dernières commandes</h2>
          </div>
          {shop.recentOrders.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Aucune commande
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {shop.recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3]">
                      #{o.orderNumber}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3]">
                      {fmt(o.totalCents)} €
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        o.status === "COMPLETED" || o.status === "PICKED_UP"
                          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                          : o.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
                            : o.status === "CANCELLED" || o.status === "DENIED"
                              ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
                      }`}
                    >
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
