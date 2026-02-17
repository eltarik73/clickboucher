// src/app/(boucher)/boucher/dashboard/page.tsx — Uber Eats tablette style dashboard
"use client";

import { useEffect, useState, useCallback } from "react";
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
  Loader2,
  AlertCircle,
  Pause,
  Play,
  Flame,
  Palmtree,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useOrderStream } from "@/hooks/useOrderStream";
import OnboardingChecklist from "@/components/boucher/OnboardingChecklist";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ShopStatus = {
  id: string;
  name: string;
  rating: number;
  ratingCount: number;
  status: string;
  busyMode: boolean;
  busyExtraMin: number;
  busyModeEndsAt: string | null;
  paused: boolean;
  pauseReason: string | null;
  pauseEndsAt: string | null;
  autoPaused: boolean;
  vacationMode: boolean;
  vacationEnd: string | null;
  vacationMessage: string | null;
  prepTimeMin: number;
  effectivePrepTime: number;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: string;
  expiresAt: string | null;
  items: { id: string; name: string; quantity: number }[];
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
  AUTO_CANCELLED:   { label: "Expiree",     color: "text-gray-500",    bg: "bg-gray-50 border-gray-200" },
  PARTIALLY_DENIED: { label: "Partielle",   color: "text-orange-700",  bg: "bg-orange-50 border-orange-200" },
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function timeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Expire";
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// Status Bar component (Uber Eats style)
// ─────────────────────────────────────────────
function StatusBar({
  shop,
  onAction,
  loading,
}: {
  shop: ShopStatus;
  onAction: (action: string, data?: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const configs: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    OPEN:        { bg: "bg-emerald-500", text: "text-white", label: "Vous etes en ligne", icon: <Play size={14} /> },
    BUSY:        { bg: "bg-amber-500",   text: "text-white", label: `Mode occupe (+${shop.busyExtraMin}min)`, icon: <Flame size={14} /> },
    PAUSED:      { bg: "bg-red-500",     text: "text-white", label: "Commandes en pause", icon: <Pause size={14} /> },
    AUTO_PAUSED: { bg: "bg-red-600",     text: "text-white", label: "Pause automatique — commandes manquees", icon: <AlertCircle size={14} /> },
    CLOSED:      { bg: "bg-gray-500",    text: "text-white", label: "Ferme", icon: <Pause size={14} /> },
    VACATION:    { bg: "bg-purple-500",  text: "text-white", label: `Vacances${shop.vacationEnd ? ` jusqu'au ${new Date(shop.vacationEnd).toLocaleDateString("fr-FR")}` : ""}`, icon: <Palmtree size={14} /> },
  };

  const config = configs[shop.status] || configs.OPEN;
  const isPausedState = shop.status === "PAUSED" || shop.status === "AUTO_PAUSED";
  const isBusy = shop.status === "BUSY";
  const isVacation = shop.status === "VACATION";

  return (
    <div className={`${config.bg} rounded-xl px-4 py-3 ${shop.status === "AUTO_PAUSED" ? "animate-pulse" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config.icon}
          <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
          {shop.pauseReason && isPausedState && (
            <span className="text-xs text-white/70">({shop.pauseReason})</span>
          )}
        </div>
        <div className="flex gap-1.5">
          {isPausedState && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => onAction("resume")}
              disabled={loading}
            >
              <Play size={12} className="mr-1" /> Reprendre
            </Button>
          )}
          {isVacation && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => onAction("end_vacation")}
              disabled={loading}
            >
              Fin vacances
            </Button>
          )}
          {isBusy && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => onAction("end_busy")}
              disabled={loading}
            >
              Arreter busy
            </Button>
          )}
          {shop.status === "OPEN" && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => onAction("pause")}
                disabled={loading}
              >
                <Pause size={12} className="mr-1" /> Pause
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => onAction("busy", { extraMin: 15, durationMin: 60 })}
                disabled={loading}
              >
                <Flame size={12} className="mr-1" /> Occupe
              </Button>
            </>
          )}
        </div>
      </div>
      {shop.pauseEndsAt && isPausedState && (
        <p className="text-xs text-white/70 mt-1">
          Reprise auto dans {timeRemaining(shop.pauseEndsAt)}
        </p>
      )}
      {shop.busyModeEndsAt && isBusy && (
        <p className="text-xs text-white/70 mt-1">
          Fin du mode occupe dans {timeRemaining(shop.busyModeEndsAt)}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────
export default function BoucherDashboardPage() {
  const { user } = useUser();
  const [shop, setShop] = useState<ShopStatus | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // SSE real-time stream
  const { connected, pendingCount: ssePendingCount } = useOrderStream({
    onNewOrder: () => {
      toast.success("Nouvelle commande !");
      fetchOrders();
    },
    onStatusChange: () => {
      fetchShopStatus();
    },
    onAutoPaused: (message) => {
      toast.error(message);
      fetchShopStatus();
    },
  });

  const fetchShopStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/shop/status");
      if (res.ok) {
        const json = await res.json();
        setShop(json.data);
      }
    } catch { /* silent */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await Promise.all([fetchShopStatus(), fetchOrders()]);
      } catch {
        setError("Erreur de connexion au serveur");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fetchShopStatus, fetchOrders]);

  // ── Shop status action ──
  async function handleStatusAction(action: string, data?: Record<string, unknown>) {
    if (!shop) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/boucher/shop/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      if (res.ok) {
        await fetchShopStatus();
        toast.success(action === "resume" ? "Commandes reprises" : `Action: ${action}`);
      } else {
        toast.error("Erreur lors du changement de statut");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Stats calculations ──
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const completedToday = todayOrders.filter((o) => o.status === "COMPLETED");
  const caToday = completedToday.reduce((sum, o) => sum + o.totalCents, 0) / 100;
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const pendingCount = pendingOrders.length;
  const recentOrders = orders.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-500 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Bonjour {user?.firstName || "Chef"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{shop?.name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {connected ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 gap-1">
                <Wifi size={10} /> En ligne
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 gap-1">
                <WifiOff size={10} /> Hors ligne
              </Badge>
            )}
          </div>
        </div>

        {/* ── Onboarding Checklist ── */}
        <OnboardingChecklist />

        {/* ── Status Bar (Uber Eats style) ── */}
        {shop && (
          <StatusBar shop={shop} onAction={handleStatusAction} loading={actionLoading} />
        )}

        {/* ── Stats Grid 2x2 ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">CA du jour</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {caToday.toFixed(2).replace(".", ",")} EUR
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Commandes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayOrders.length}</p>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-sm ${pendingCount > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-white dark:bg-[#141414]"}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pendingCount > 0 ? "bg-red-200" : "bg-amber-100"}`}>
                  <Clock className={`w-4 h-4 ${pendingCount > 0 ? "text-red-600" : "text-amber-600"}`} />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">En attente</span>
              </div>
              <p className={`text-2xl font-bold ${pendingCount > 0 ? "text-red-600" : "text-gray-900 dark:text-white"}`}>
                {ssePendingCount || pendingCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Star className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Note</span>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {shop?.rating?.toFixed(1) || "—"}
                </p>
                <span className="text-xs text-gray-400 dark:text-gray-500">/5 ({shop?.ratingCount || 0})</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Quick actions ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Actions rapides</h2>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/boucher/commandes">
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex flex-col items-center gap-1.5 bg-white dark:bg-[#141414] hover:bg-gray-50 dark:hover:bg-white/5 border-gray-200 dark:border-white/10"
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
                className="w-full h-auto py-3 flex flex-col items-center gap-1.5 bg-white dark:bg-[#141414] hover:bg-gray-50 dark:hover:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <Package className="w-5 h-5 text-[#DC2626]" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Produits</span>
              </Button>
            </Link>

            <Link href="/boucher/parametres">
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex flex-col items-center gap-1.5 bg-white dark:bg-[#141414] hover:bg-gray-50 dark:hover:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <Clock className="w-5 h-5 text-[#DC2626]" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Parametres</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Recent orders ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dernieres commandes</h2>
            <Link href="/boucher/commandes" className="text-xs text-[#DC2626] font-medium hover:underline">
              Tout voir
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
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
                    <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0">
                              <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
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
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {(order.totalCents / 100).toFixed(2).replace(".", ",")} EUR
                            </span>
                            <Badge variant="outline" className={`text-[10px] font-semibold border ${st.bg} ${st.color}`}>
                              {st.label}
                            </Badge>
                            {order.status === "PENDING" && order.expiresAt && (
                              <span className="text-[9px] font-mono text-red-500">
                                {timeRemaining(order.expiresAt)}
                              </span>
                            )}
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
