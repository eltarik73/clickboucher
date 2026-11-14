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
  Sparkles,
  Leaf,
  FileSpreadsheet,
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

// GET /api/boucher/orders/summary (src/lib/services/orders/shop-summary.ts), dates serialized.
type DaySummary = {
  ordersToday: number;
  revenueTodayCents: number;
  recent: {
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    createdAt: string;
    expiresAt: string | null;
    itemCount: number;
    user: { firstName: string; lastName: string };
  }[];
};

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: {
    label: "En attente",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  },
  ACCEPTED: {
    label: "Acceptée",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  },
  PREPARING: {
    label: "En prépa",
    color: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
  },
  READY: {
    label: "Prête",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  },
  PICKED_UP: {
    label: "Retirée",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",
  },
  COMPLETED: {
    label: "Terminée",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
  },
  DENIED: {
    label: "Refusée",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
  },
  CANCELLED: {
    label: "Annulée",
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",
  },
  AUTO_CANCELLED: {
    label: "Expirée",
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",
  },
  PARTIALLY_DENIED: {
    label: "Partielle",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
  },
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function timeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const h = Math.floor(diff / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h} h ${min.toString().padStart(2, "0")} min`;
  if (min > 0) return `${min} min ${sec.toString().padStart(2, "0")} s`;
  return `${sec} s`;
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
  const configs: Record<
    string,
    { bg: string; text: string; label: string; icon: React.ReactNode }
  > = {
    OPEN: {
      bg: "bg-emerald-500",
      text: "text-white",
      label: "Vous êtes en ligne",
      icon: <Play size={14} />,
    },
    BUSY: {
      bg: "bg-amber-500",
      text: "text-white",
      label: `Mode occupé (+${shop.busyExtraMin}min)`,
      icon: <Flame size={14} />,
    },
    PAUSED: {
      bg: "bg-red-500",
      text: "text-white",
      label: "Commandes en pause",
      icon: <Pause size={14} />,
    },
    AUTO_PAUSED: {
      bg: "bg-red-600",
      text: "text-white",
      label: "Pause automatique — commandes manquées",
      icon: <AlertCircle size={14} />,
    },
    CLOSED: { bg: "bg-gray-500", text: "text-white", label: "Fermé", icon: <Pause size={14} /> },
    VACATION: {
      bg: "bg-purple-500",
      text: "text-white",
      label: `Vacances${shop.vacationEnd ? ` jusqu'au ${new Date(shop.vacationEnd).toLocaleDateString("fr-FR")}` : ""}`,
      icon: <Palmtree size={14} />,
    },
  };

  const config = configs[shop.status] || configs.OPEN;
  const isPausedState = shop.status === "PAUSED" || shop.status === "AUTO_PAUSED";
  const isBusy = shop.status === "BUSY";
  const isVacation = shop.status === "VACATION";

  return (
    <div
      className={`${config.bg} rounded-xl px-4 py-3 ${shop.status === "AUTO_PAUSED" ? "animate-pulse" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {config.icon}
          <span className={`text-sm font-semibold ${config.text} truncate`}>{config.label}</span>
          {shop.pauseReason && isPausedState && (
            <span className="truncate text-xs text-white/70">({shop.pauseReason})</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isPausedState && (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
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
              className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
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
              className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
              onClick={() => onAction("end_busy")}
              disabled={loading}
            >
              Arrêter busy
            </Button>
          )}
          {shop.status === "CLOSED" && (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 border-0 bg-emerald-500/80 text-xs text-white hover:bg-emerald-500"
              onClick={() => onAction("resume")}
              disabled={loading}
            >
              <Play size={12} className="mr-1" /> Passer en ligne
            </Button>
          )}
          {shop.status === "OPEN" && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() => onAction("pause")}
                disabled={loading}
              >
                <Pause size={12} className="mr-1" /> Pause
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() => onAction("busy", { extraMin: 15, durationMin: 60 })}
                disabled={loading}
              >
                <Flame size={12} className="mr-1" /> Occupé
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() => onAction("close")}
                disabled={loading}
              >
                <WifiOff size={12} className="mr-1" /> Fermer
              </Button>
            </>
          )}
        </div>
      </div>
      {shop.pauseEndsAt && isPausedState && (
        <p className="mt-1 text-xs text-white/70">
          Reprise auto dans {timeRemaining(shop.pauseEndsAt)}
        </p>
      )}
      {shop.busyModeEndsAt && isBusy && (
        <p className="mt-1 text-xs text-white/70">
          Fin du mode occupé dans {timeRemaining(shop.busyModeEndsAt)}
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
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // SSE real-time stream
  const { connected, pendingCount: ssePendingCount } = useOrderStream({
    onNewOrder: () => {
      toast.success("Nouvelle commande !");
      fetchSummary();
    },
    onStatusChange: () => {
      fetchShopStatus();
      fetchSummary();
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
    } catch {
      /* silent */
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/orders/summary");
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
      }
    } catch {
      /* silent */
    }
  }, []);

  // The server count of orders waiting for an answer, read again whenever the stream's count moves.
  useEffect(() => {
    async function fetchPendingCount() {
      try {
        const res = await fetch("/api/boucher/orders/pending-count");
        if (res.ok) {
          const json = await res.json();
          setPendingCount(json.data?.pending ?? 0);
        }
      } catch {
        /* silent */
      }
    }
    fetchPendingCount();
  }, [ssePendingCount]);

  useEffect(() => {
    async function load() {
      try {
        await Promise.all([fetchShopStatus(), fetchSummary()]);
      } catch {
        setError("Erreur de connexion au serveur");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fetchShopStatus, fetchSummary]);

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
        const actionMessages: Record<string, string> = {
          resume: "Boutique en ligne",
          pause: "Boutique en pause",
          close: "Boutique fermée",
          busy: "Mode occupé activé",
          end_busy: "Mode occupé désactivé",
          end_vacation: "Fin des vacances",
        };
        toast.success(actionMessages[action] || `Action: ${action}`);
      } else {
        toast.error("Erreur lors du changement de statut");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setActionLoading(false);
    }
  }

  const caToday = (summary?.revenueTodayCents ?? 0) / 100;
  const recentOrders = summary?.recent ?? [];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-3xl space-y-4 px-5 py-6">
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
              <Badge
                variant="outline"
                className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
              >
                <Wifi size={10} /> En ligne
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-red-200 bg-red-50 text-[10px] text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              >
                <WifiOff size={10} /> Hors ligne
              </Badge>
            )}
          </div>
        </div>

        {/* ── Onboarding Checklist ── */}
        <OnboardingChecklist />

        {/* ── Status Bar (Uber Eats style) ── */}
        {shop && <StatusBar shop={shop} onAction={handleStatusAction} loading={actionLoading} />}

        {/* ── Stats Grid 2x2 ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">CA du jour</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {caToday.toFixed(2).replace(".", ",")} EUR
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Commandes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary?.ordersToday ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card
            className={`border-0 shadow-sm ${pendingCount > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-white dark:bg-[#141414]"}`}
          >
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${pendingCount > 0 ? "bg-red-200 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}
                >
                  <Clock
                    className={`h-4 w-4 ${pendingCount > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">En attente</span>
              </div>
              <p
                className={`text-2xl font-bold ${pendingCount > 0 ? "text-red-600" : "text-gray-900 dark:text-white"}`}
              >
                {pendingCount}
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Note</span>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {shop?.rating?.toFixed(1) || "—"}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  /5 ({shop?.ratingCount || 0})
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Quick actions ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Actions rapides
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/boucher/commandes">
              <Button
                variant="outline"
                className="flex h-auto w-full flex-col items-center gap-1.5 border-gray-200 bg-white py-3 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
              >
                <div className="relative">
                  <Bell className="h-5 w-5 text-[#DC2626]" />
                  {pendingCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-0.5 text-[9px] font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Commandes
                </span>
              </Button>
            </Link>

            <Link href="/boucher/produits">
              <Button
                variant="outline"
                className="flex h-auto w-full flex-col items-center gap-1.5 border-gray-200 bg-white py-3 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
              >
                <Package className="h-5 w-5 text-[#DC2626]" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Produits
                </span>
              </Button>
            </Link>

            <Link href="/boucher/dashboard/statistiques">
              <Button
                variant="outline"
                className="flex h-auto w-full flex-col items-center gap-1.5 border-gray-200 bg-white py-3 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
              >
                <Star className="h-5 w-5 text-[#DC2626]" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Statistiques
                </span>
              </Button>
            </Link>

            <Link href="/boucher/dashboard/parrainage">
              <Button
                variant="outline"
                className="flex h-auto w-full flex-col items-center gap-1.5 border-gray-200 bg-white py-3 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
              >
                <Sparkles className="h-5 w-5 text-[#DC2626]" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Parrainage
                </span>
              </Button>
            </Link>

            <Link href="/boucher/dashboard/anti-gaspi">
              <Button
                variant="outline"
                className="flex h-auto w-full flex-col items-center gap-1.5 border-gray-200 bg-white py-3 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
              >
                <Leaf className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Anti-Gaspi
                </span>
              </Button>
            </Link>

            <Link href="/boucher/dashboard/export">
              <Button
                variant="outline"
                className="flex h-auto w-full flex-col items-center gap-1.5 border-gray-200 bg-white py-3 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
              >
                <FileSpreadsheet className="h-5 w-5 text-[#DC2626]" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Export</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Recent orders ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Dernières commandes
            </h2>
            <Link
              href="/boucher/commandes"
              className="text-xs font-medium text-[#DC2626] hover:underline"
            >
              Tout voir
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aucune commande pour le moment
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const st = STATUS_MAP[order.status] || STATUS_MAP.PENDING;
                const clientName = `${order.user.firstName} ${order.user.lastName.charAt(0)}.`;

                return (
                  <Link key={order.id} href="/boucher/historique">
                    <Card className="cursor-pointer border-0 bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-[#141414]">
                      <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="shrink-0">
                              <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                                {order.orderNumber}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                                {clientName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {order.itemCount} article{order.itemCount > 1 ? "s" : ""} ·{" "}
                                {formatTime(order.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {(order.totalCents / 100).toFixed(2).replace(".", ",")} EUR
                            </span>
                            <Badge
                              variant="outline"
                              className={`border text-[10px] font-semibold ${st.bg} ${st.color}`}
                            >
                              {st.label}
                            </Badge>
                            {order.status === "PENDING" && order.expiresAt && (
                              <span className="font-mono text-[9px] text-red-500">
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
