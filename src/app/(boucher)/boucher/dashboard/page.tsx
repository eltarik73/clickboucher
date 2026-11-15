// src/app/(boucher)/boucher/dashboard/page.tsx — Uber Eats tablette style dashboard
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Package,
  Clock,
  Star,
  Bell,
  Loader2,
  AlertCircle,
  Sparkles,
  Leaf,
  FileSpreadsheet,
} from "lucide-react";
import { usePendingOrderCount } from "@/hooks/use-pending-order-count";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import OnboardingChecklist from "@/components/boucher/OnboardingChecklist";
import { DaySummaryCard, type DaySummary } from "@/components/boucher/dashboard/DaySummaryCard";
import { ShopStatusBar, type ShopStatus } from "@/components/boucher/dashboard/ShopStatusBar";
import { toast } from "sonner";

/** Cadence of the dashboard figures and shop status (the pending count has its own, 30 s). */
const DASHBOARD_REFRESH_MS = 60_000;

// ─────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────
export default function BoucherDashboardPage() {
  const { user } = useUser();
  const [shop, setShop] = useState<ShopStatus | null>(null);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchShopStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/boucher/shop/status");
      if (!res.ok) return false;
      const json = await res.json();
      setShop(json.data);
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchSummary = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/boucher/orders/summary");
      if (!res.ok) return false;
      const json = await res.json();
      setSummary(json.data);
      return true;
    } catch {
      return false;
    }
  }, []);

  const pending = usePendingOrderCount();
  const pendingCount = pending ?? 0;
  const lastPendingRef = useRef<number | null>(null);

  // A change of the pending count reads the figures and the shop status at once; the first count
  // the page sees is not a change.
  useEffect(() => {
    if (pending === null) return;
    const previous = lastPendingRef.current;
    lastPendingRef.current = pending;
    if (previous === null || previous === pending) return;
    void fetchSummary();
    void fetchShopStatus();
    if (pending > previous) toast.success("Nouvelle commande !");
  }, [pending, fetchSummary, fetchShopStatus]);

  // Day figures, recent orders and shop status: read at mount, then every minute while the tab is
  // visible, so that a change that leaves the pending count as it is (an order picked up, an
  // auto-pause) still shows.
  const refreshDashboard = useCallback(async (): Promise<boolean> => {
    const [statusRead, summaryRead] = await Promise.all([fetchShopStatus(), fetchSummary()]);
    setLoading(false);
    return statusRead && summaryRead;
  }, [fetchShopStatus, fetchSummary]);

  useVisiblePolling(refreshDashboard, DASHBOARD_REFRESH_MS);

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  // Neither read has ever succeeded: nothing to show but the failure (the polling keeps trying).
  if (!shop && !summary) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Erreur de connexion au serveur
        </p>
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
        </div>

        {/* ── Onboarding Checklist ── */}
        <OnboardingChecklist />

        {/* ── Status Bar (Uber Eats style) ── */}
        {shop && (
          <ShopStatusBar
            shop={shop}
            onAction={(action, data) => void handleStatusAction(action, data)}
            loading={actionLoading}
          />
        )}

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
        <DaySummaryCard orders={summary?.recent ?? []} />
      </div>
    </div>
  );
}
