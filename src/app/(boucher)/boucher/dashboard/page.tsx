"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Package,
  Clock,
  Star,
  Bell,
  Settings,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Shop = {
  id: string;
  name: string;
  rating: number;
  ratingCount: number;
  busyMode: boolean;
  paused: boolean;
  isOpen: boolean;
  prepTimeMin: number;
  busyExtraMin: number;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: string;
  items: { id: string }[];
  user: { firstName: string; lastName: string } | null;
};

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:          { label: "En attente",  color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  ACCEPTED:         { label: "Acceptee",    color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  PREPARING:        { label: "En prepa",    color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200" },
  READY:            { label: "Prete",       color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  PICKED_UP:        { label: "Retiree",     color: "text-gray-600",    bg: "bg-gray-50 border-gray-200" },
  COMPLETED:        { label: "Terminee",    color: "text-green-700",   bg: "bg-green-50 border-green-200" },
  DENIED:           { label: "Refusee",     color: "text-red-700",     bg: "bg-red-50 border-red-200" },
  CANCELLED:        { label: "Annulee",     color: "text-gray-500",    bg: "bg-gray-50 border-gray-200" },
  PARTIALLY_DENIED: { label: "Partielle",   color: "text-orange-700",  bg: "bg-orange-50 border-orange-200" },
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────
export default function BoucherDashboardPage() {
  const { user } = useUser();
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [shopRes, ordersRes] = await Promise.all([
          fetch("/api/shops/my-shop"),
          fetch("/api/orders"),
        ]);

        if (shopRes.ok) {
          const shopJson = await shopRes.json();
          setShop(shopJson.data);
        } else {
          setError("Impossible de charger votre boucherie");
        }

        if (ordersRes.ok) {
          const ordersJson = await ordersRes.json();
          setOrders(ordersJson.data || []);
        }
      } catch {
        setError("Erreur de connexion au serveur");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Toggle busy mode ──
  async function toggleBusy() {
    if (!shop) return;
    setTogglingBusy(true);
    try {
      const res = await fetch(`/api/shops/${shop.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busyMode: !shop.busyMode }),
      });
      if (res.ok) {
        setShop({ ...shop, busyMode: !shop.busyMode });
      }
    } catch {
      // silent
    } finally {
      setTogglingBusy(false);
    }
  }

  // ── Stats calculations ──
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(
    (o) => o.createdAt.slice(0, 10) === today
  );
  const completedToday = todayOrders.filter((o) => o.status === "COMPLETED");
  const caToday = completedToday.reduce((sum, o) => sum + o.totalCents, 0) / 100;
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const recentOrders = orders.slice(0, 5);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-500 text-center">{error}</p>
      </div>
    );
  }

  const shopStatus = shop?.paused
    ? { label: "Pause", style: "bg-red-100 text-red-700 border-red-200" }
    : shop?.busyMode
      ? { label: "Occupe", style: "bg-amber-100 text-amber-700 border-amber-200" }
      : { label: "Ouvert", style: "bg-emerald-100 text-emerald-700 border-emerald-200" };

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#1a1814]">
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            Bonjour {user?.firstName || "Chef"} 👋
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">{shop?.name}</p>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold border ${shopStatus.style}`}
            >
              {shopStatus.label}
            </Badge>
          </div>
        </div>

        {/* ── Stats Grid 2x2 ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* CA du jour */}
          <Card className="bg-white dark:bg-[#2a2520] border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">CA du jour</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
                {caToday.toFixed(2).replace(".", ",")} €
              </p>
            </CardContent>
          </Card>

          {/* Commandes du jour */}
          <Card className="bg-white dark:bg-[#2a2520] border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Commandes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
                {todayOrders.length}
              </p>
            </CardContent>
          </Card>

          {/* En attente */}
          <Card className={`border-0 shadow-sm ${pendingCount > 0 ? "bg-red-50" : "bg-white"}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pendingCount > 0 ? "bg-red-200" : "bg-amber-100"}`}>
                  <Clock className={`w-4 h-4 ${pendingCount > 0 ? "text-red-600" : "text-amber-600"}`} />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">En attente</span>
              </div>
              <p className={`text-2xl font-bold ${pendingCount > 0 ? "text-red-600" : "text-gray-900 dark:text-[#f8f6f3]"}`}>
                {pendingCount}
              </p>
            </CardContent>
          </Card>

          {/* Note moyenne */}
          <Card className="bg-white dark:bg-[#2a2520] border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Star className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Note</span>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
                  {shop?.rating?.toFixed(1) || "—"}
                </p>
                <span className="text-xs text-gray-400 dark:text-gray-500">/5 ({shop?.ratingCount || 0})</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Actions rapides ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Actions rapides</h2>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/boucher/commandes">
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex flex-col items-center gap-1.5 bg-white dark:bg-[#2a2520] hover:bg-gray-50 dark:hover:bg-[#3a3530] border-gray-200 dark:border-[#3a3530]"
              >
                <div className="relative">
                  <Bell className="w-5 h-5 text-[#DC2626]" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-[#DC2626] text-white text-[9px] font-bold rounded-full px-0.5">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Commandes</span>
              </Button>
            </Link>

            <Link href="/boucher/produits">
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex flex-col items-center gap-1.5 bg-white dark:bg-[#2a2520] hover:bg-gray-50 dark:hover:bg-[#3a3530] border-gray-200 dark:border-[#3a3530]"
              >
                <Package className="w-5 h-5 text-[#DC2626]" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Stock</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={toggleBusy}
              disabled={togglingBusy}
              className={`h-auto py-3 flex flex-col items-center gap-1.5 border-gray-200 ${
                shop?.busyMode
                  ? "bg-amber-50 hover:bg-amber-100 border-amber-300"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              {togglingBusy ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : (
                <Settings className={`w-5 h-5 ${shop?.busyMode ? "text-amber-600" : "text-[#DC2626]"}`} />
              )}
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {shop?.busyMode ? "Desactiver" : "Mode occupe"}
              </span>
            </Button>
          </div>
        </div>

        {/* ── Dernieres commandes ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dernières commandes</h2>
            <Link
              href="/boucher/commandes"
              className="text-xs text-[#DC2626] font-medium hover:underline"
            >
              Tout voir
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <Card className="bg-white dark:bg-[#2a2520] border-0 shadow-sm">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">Aucune commande pour le moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const st = STATUS_MAP[order.status] || STATUS_MAP.PENDING;
                const clientName = order.user
                  ? `${order.user.firstName} ${order.user.lastName}`
                  : "Client";

                return (
                  <Link key={order.id} href="/boucher/commandes">
                    <Card className="bg-white dark:bg-[#2a2520] border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0">
                              <span className="text-xs font-mono font-semibold text-gray-900 dark:text-[#f8f6f3]">
                                {order.orderNumber}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {clientName}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {order.items.length} article{order.items.length > 1 ? "s" : ""} · {formatTime(order.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">
                              {(order.totalCents / 100).toFixed(2).replace(".", ",")} €
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold border ${st.bg} ${st.color}`}
                            >
                              {st.label}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
