// /boucher/commandes — MODE CUISINE (v6)
// Full-screen tablet kitchen interface — dark theme, big buttons, audio alerts
// 3 columns: Nouvelles (25%) | En cours (45%) | Pretes (30%)
// Bottom bar: Historique + Programmees → Sheet drawers
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bell,
  ChefHat,
  CheckCircle,
  Loader2,
  Wifi,
  WifiOff,
  ArrowLeft,
  ScanLine,
  Volume2,
  VolumeX,
  ScrollText,
  CalendarClock,
  Package,
  XCircle,
  Ban,
  Clock,
  Monitor,
  MonitorOff,
} from "lucide-react";
import Link from "next/link";
import { useOrderPolling, type KitchenOrder } from "@/hooks/use-order-polling";
import { soundManager } from "@/lib/notification-sound";
import { startOrderAlert, stopOrderAlert } from "@/lib/sounds";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useKitchenNotifications } from "@/hooks/use-kitchen-notifications";
import dynamic from "next/dynamic";
import KitchenOrderCard from "@/components/boucher/KitchenOrderCard";

// Lazy-load: conditionally displayed (modals, overlays, scanner)
const AudioUnlockScreen = dynamic(
  () => import("@/components/boucher/AudioUnlockScreen"),
  { ssr: false }
);
const OrderAlertOverlay = dynamic(
  () => import("@/components/boucher/OrderAlertOverlay"),
  { ssr: false }
);
const ItemUnavailableModal = dynamic(
  () => import("@/components/boucher/ItemUnavailableModal"),
  { ssr: false }
);
const PriceAdjustModal = dynamic(
  () => import("@/components/boucher/PriceAdjustModal"),
  { ssr: false }
);
const QRScanner = dynamic(
  () => import("@/components/boucher/QRScanner").then((m) => m.QRScanner),
  { ssr: false }
);
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Tab = "nouvelles" | "en-cours" | "pretes";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────
// Status badge for history
// ─────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PICKED_UP: { label: "Recuperee", color: "bg-emerald-500/20 text-emerald-400", icon: Package },
  COMPLETED: { label: "Terminee", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  DENIED: { label: "Refusee", color: "bg-red-500/20 text-red-400", icon: XCircle },
  CANCELLED: { label: "Annulee", color: "bg-red-500/20 text-red-400", icon: Ban },
  AUTO_CANCELLED: { label: "Expiree", color: "bg-gray-500/20 text-gray-400", icon: Ban },
  PARTIALLY_DENIED: { label: "Partielle", color: "bg-orange-500/20 text-orange-400", icon: XCircle },
};

// ─────────────────────────────────────────────
// Main Kitchen Page
// ─────────────────────────────────────────────
export default function KitchenModePage() {
  // Audio unlock state (persisted per session)
  const [audioUnlocked, setAudioUnlocked] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("audioUnlocked") === "true";
    }
    return false;
  });

  // Shop info
  const [shopName, setShopName] = useState("");
  const [shopPrepTime, setShopPrepTime] = useState(15);
  const [shopStatus, setShopStatus] = useState("OPEN");

  // Alert overlay
  const [alertOrder, setAlertOrder] = useState<KitchenOrder | null>(null);

  // Active tab (mobile) — desktop uses multi-column layout
  const [activeTab, setActiveTab] = useState<Tab>("nouvelles");

  // Modals
  const [stockIssueOrder, setStockIssueOrder] = useState<KitchenOrder | null>(null);
  const [adjustPriceOrder, setAdjustPriceOrder] = useState<KitchenOrder | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Bottom bar drawers
  const [showHistory, setShowHistory] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);

  // Sound muted
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Connected indicator
  const [connected, setConnected] = useState(true);
  const lastFetchRef = useRef(Date.now());

  // Wake Lock — keep screen on in kitchen mode
  const { active: wakeLockActive, supported: wakeLockSupported } = useWakeLock();

  // Track seen order IDs (orders the boucher has already clicked VOIR on)
  const seenOrderIdsRef = useRef<Set<string>>(new Set());

  // Ref for browser notification function (set after useKitchenNotifications)
  const sendNotificationRef = useRef<((order: KitchenOrder) => void) | null>(null);

  // ── Polling with 5s interval ──
  const {
    orders,
    loading,
    pendingOrders,
    inProgressOrders,
    readyOrders,
    historyOrders,
    scheduledOrders,
    pendingCount,
    inProgressCount,
    readyCount,
    historyCount,
    scheduledCount,
    refetch,
  } = useOrderPolling({
    intervalMs: 5000,
    onNewOrder: (order) => {
      // Skip sound for already-seen orders
      if (seenOrderIdsRef.current.has(order.id)) return;
      // Show alert overlay
      setAlertOrder(order);
      // Switch to "nouvelles" tab
      setActiveTab("nouvelles");
      // Play Marimba Song alert (loops until action, if not muted)
      if (!mutedRef.current) {
        startOrderAlert();
      }
      // Send browser notification (if tab is in background)
      sendNotificationRef.current?.(order);
    },
    onStatusChange: () => {
      // Refresh shop status on any change
      fetchShopInfo();
    },
  });

  // Kitchen notifications — title blink, favicon badge, browser notifications
  const { sendOrderNotification } = useKitchenNotifications(pendingCount);
  sendNotificationRef.current = sendOrderNotification;

  // Track connection status
  useEffect(() => {
    if (!loading) {
      lastFetchRef.current = Date.now();
      setConnected(true);
    }
    const checker = setInterval(() => {
      const stale = Date.now() - lastFetchRef.current > 15_000;
      setConnected(!stale);
    }, 5000);
    return () => clearInterval(checker);
  }, [loading]);

  // ── Fetch shop info (once + on status change) ──
  const fetchShopInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/shop/status");
      if (res.ok) {
        const json = await res.json();
        setShopName(json.data?.name || "");
        setShopPrepTime(json.data?.prepTimeMin || 15);
        setShopStatus(json.data?.status || "OPEN");
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchShopInfo();
  }, [fetchShopInfo]);

  // ── Stop alert when no more pending orders ──
  useEffect(() => {
    if (pendingCount === 0) {
      stopOrderAlert();
    }
  }, [pendingCount]);

  // ── Cleanup alert on unmount ──
  useEffect(() => {
    return () => stopOrderAlert();
  }, []);

  // ── Handle VOIR click: stop sound + mark as seen ──
  const handleViewOrder = useCallback((orderId: string) => {
    seenOrderIdsRef.current.add(orderId);
    stopOrderAlert();
    // Dismiss alert overlay if it's showing for this order
    setAlertOrder((prev) => (prev?.id === orderId ? null : prev));
  }, []);

  // ── Handle order action (unified API) ──
  async function handleAction(orderId: string, action: string, data?: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/boucher/orders/${orderId}/action`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      if (res.ok) {
        // Stop marimba on accept/deny actions
        if (["accept", "deny", "cancel"].includes(action)) {
          stopOrderAlert();
        }
        await refetch();
        const actionLabels: Record<string, string> = {
          accept: "Commande acceptee",
          deny: "Commande refusee",
          start_preparing: "Preparation lancee",
          mark_ready: "Commande prete !",
          confirm_pickup: "Retrait confirme",
          manual_pickup: "Retrait confirme",
          add_time: "Temps ajoute",
          item_unavailable: "Rupture signalee",
          cancel: "Commande annulee",
        };
        toast.success(actionLabels[action] || "Action effectuee");
      } else {
        const json = await res.json().catch(() => null);
        const msg = json?.error?.message || "Erreur lors de l'action";
        toast.error(msg);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
  }

  // ── Handle stock issue ──
  async function handleStockIssue(orderId: string, itemIds: string[]) {
    try {
      const res = await fetch(`/api/boucher/orders/${orderId}/action`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "item_unavailable", itemIds }),
      });
      if (res.ok) {
        await refetch();
        toast.success("Rupture signalee");
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || "Erreur lors du signalement");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
  }

  // ── Handle price adjustment ──
  async function handleAdjustPrice(orderId: string, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/orders/${orderId}/adjust-price`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        await refetch();
        if (json.data?.autoApproved) {
          toast.success("Prix ajuste automatiquement (baisse)");
        } else {
          toast.success("Ajustement envoye — en attente du client (5 min)");
        }
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || "Erreur lors de l'ajustement");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
  }

  // ── Audio unlock screen ──
  if (!audioUnlocked) {
    return <AudioUnlockScreen onUnlocked={() => setAudioUnlocked(true)} />;
  }

  // ── Loading state ──
  if (loading && orders.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#DC2626] mx-auto" />
          <p className="text-gray-500 text-sm">Chargement des commandes...</p>
        </div>
      </div>
    );
  }

  // Tab data (3 main tabs only — Historique/Programmées in bottom bar drawers)
  const tabs: { key: Tab; label: string; count: number; icon: typeof Bell; color: string }[] = [
    { key: "nouvelles", label: "Nouvelles", count: pendingCount, icon: Bell, color: "amber" },
    { key: "en-cours", label: "En cours", count: inProgressCount, icon: ChefHat, color: "blue" },
    { key: "pretes", label: "Pretes", count: readyCount, icon: CheckCircle, color: "emerald" },
  ];

  // Get orders for active tab (mobile)
  const activeOrders =
    activeTab === "nouvelles"
      ? pendingOrders
      : activeTab === "en-cours"
      ? inProgressOrders
      : readyOrders;

  return (
    <>
      {/* ── Alert overlay (new order) ── */}
      <OrderAlertOverlay
        order={alertOrder}
        onDismiss={() => {
          stopOrderAlert();
          setAlertOrder(null);
        }}
      />

      {/* ── Stock issue modal ── */}
      {stockIssueOrder && (
        <ItemUnavailableModal
          order={stockIssueOrder}
          onClose={() => setStockIssueOrder(null)}
          onConfirm={handleStockIssue}
        />
      )}

      {/* ── Price adjust modal ── */}
      {adjustPriceOrder && (
        <PriceAdjustModal
          order={adjustPriceOrder}
          onClose={() => setAdjustPriceOrder(null)}
          onConfirm={handleAdjustPrice}
        />
      )}

      {/* ── QR Scanner modal ── */}
      {showScanner && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-white font-bold text-base">Scanner QR de retrait</h3>
            <QRScanner
              onClose={() => setShowScanner(false)}
              onScanned={() => {
                setShowScanner(false);
                refetch();
              }}
            />
            <button
              onClick={() => setShowScanner(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── KITCHEN INTERFACE ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col">
        {/* ── Top bar ── */}
        <header className="shrink-0 bg-[#111] border-b border-white/5 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/boucher/dashboard"
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm min-h-[44px] min-w-[44px] justify-center"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="w-px h-5 bg-white/10" />
            <div>
              <h1 className="text-sm font-bold text-white leading-none">
                Mode Cuisine
              </h1>
              {shopName && (
                <p className="text-[10px] text-gray-500 mt-0.5">{shopName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Shop status toggle (busy/pause) */}
            <button
              onClick={async () => {
                try {
                  const action = shopStatus === "OPEN" ? "busy" : shopStatus === "BUSY" ? "pause" : "resume";
                  const body: Record<string, unknown> = { action };
                  if (action === "busy") body.extraMinutes = 15;
                  if (action === "pause") body.reason = "Pause manuelle";
                  const res = await fetch("/api/boucher/shop/status", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  if (res.ok) {
                    fetchShopInfo();
                    const labels: Record<string, string> = { busy: "Mode occupe active", pause: "Boutique en pause", resume: "Boutique en ligne" };
                    toast.success(labels[action] || "Statut mis a jour");
                  }
                } catch { toast.error("Erreur de mise a jour du statut"); }
              }}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-md min-h-[32px] transition-colors ${
                shopStatus === "OPEN"
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  : shopStatus === "BUSY"
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              }`}
              title={shopStatus === "OPEN" ? "Passer en occupe" : shopStatus === "BUSY" ? "Mettre en pause" : "Remettre en ligne"}
            >
              {shopStatus === "OPEN" ? "En ligne" : shopStatus === "BUSY" ? "Occupe" : shopStatus === "PAUSED" ? "En pause" : shopStatus}
            </button>

            {/* Time */}
            <span className="text-xs text-gray-500 font-mono hidden sm:block">
              {formatTime(new Date().toISOString())}
            </span>

            {/* Sound toggle */}
            <button
              onClick={() => setMuted(!muted)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
                muted
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/5 text-gray-400 hover:text-white"
              }`}
              title={muted ? "Son desactive" : "Son active"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* QR Scanner */}
            <button
              onClick={() => setShowScanner(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Scanner QR"
            >
              <ScanLine size={18} />
            </button>

            {/* Wake Lock indicator */}
            <div
              className="flex items-center gap-1 min-h-[44px] min-w-[44px] justify-center"
              title={
                !wakeLockSupported
                  ? "Wake Lock non supporte — desactivez la mise en veille manuellement"
                  : wakeLockActive
                  ? "Ecran maintenu allume"
                  : "Ecran peut se mettre en veille"
              }
            >
              {wakeLockActive ? (
                <Monitor size={16} className="text-emerald-400" />
              ) : (
                <MonitorOff size={16} className="text-gray-600" />
              )}
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-1 min-h-[44px] min-w-[44px] justify-center">
              {connected ? (
                <Wifi size={16} className="text-emerald-400" />
              ) : (
                <WifiOff size={16} className="text-red-400 animate-pulse" />
              )}
            </div>
          </div>
        </header>

        {/* ── Wake Lock not supported warning ── */}
        {!wakeLockSupported && (
          <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center">
            <p className="text-[11px] text-amber-400">
              Desactivez la mise en veille dans les parametres de votre tablette
            </p>
          </div>
        )}

        {/* ── Mobile tabs (md-) ── */}
        <div className="md:hidden shrink-0 bg-[#111] border-b border-white/5 px-2 py-1.5">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 flex-1 flex items-center justify-center gap-1 min-h-[44px] px-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#DC2626] text-white"
                      : "text-gray-500 hover:bg-white/5"
                  }`}
                >
                  <Icon size={14} />
                  <span className="truncate">{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : tab.key === "nouvelles"
                          ? "bg-[#DC2626] text-white"
                          : "bg-white/10 text-gray-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* ── DESKTOP: 3-column layout (25%/45%/30%) ── */}
        {/* ══════════════════════════════════════════ */}
        <div className="flex-1 overflow-hidden hidden md:flex pb-14">
          {/* Column 1: Nouvelles (25%) */}
          <div className="w-1/4 shrink-0">
            <KitchenColumn
              title="Nouvelles"
              count={pendingCount}
              icon={<Bell size={16} />}
              color="amber"
              orders={pendingOrders}
              shopName={shopName}
              shopPrepTime={shopPrepTime}
              onAction={handleAction}
              onStockIssue={setStockIssueOrder}
              onView={handleViewOrder}
              emptyMessage="Aucune nouvelle commande"
              emptyIcon={<Bell size={32} className="text-gray-700" />}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-white/5 shrink-0" />

          {/* Column 2: En cours (45% — flex-1) */}
          <div className="flex-1 min-w-0">
            <KitchenColumn
              title="En cours"
              count={inProgressCount}
              icon={<ChefHat size={16} />}
              color="blue"
              orders={inProgressOrders}
              shopName={shopName}
              shopPrepTime={shopPrepTime}
              onAction={handleAction}
              onStockIssue={setStockIssueOrder}
              onView={handleViewOrder}
              onAdjustPrice={setAdjustPriceOrder}
              emptyMessage="Aucune commande en cours"
              emptyIcon={<ChefHat size={32} className="text-gray-700" />}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-white/5 shrink-0" />

          {/* Column 3: Pretes (30%) */}
          <div className="w-[30%] shrink-0">
            <KitchenColumn
              title="Pretes"
              count={readyCount}
              icon={<CheckCircle size={16} />}
              color="emerald"
              orders={readyOrders}
              shopName={shopName}
              shopPrepTime={shopPrepTime}
              onAction={handleAction}
              onStockIssue={setStockIssueOrder}
              onView={handleViewOrder}
              emptyMessage="Aucune commande prete"
              emptyIcon={<CheckCircle size={32} className="text-gray-700" />}
              extra={
                readyCount > 0 ? (
                  <button
                    onClick={() => setShowScanner(true)}
                    className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#b91c1c] active:scale-95 text-white font-bold min-h-[44px] py-3 rounded-xl transition-all mb-3"
                  >
                    <ScanLine size={16} /> Scanner QR
                  </button>
                ) : null
              }
            />
          </div>
        </div>

        {/* ── Desktop bottom bar (Historique + Programmées) ── */}
        <div className="hidden md:flex fixed bottom-0 inset-x-0 h-14 bg-zinc-900 border-t border-zinc-800 items-center justify-center gap-4 px-6 z-40">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm font-medium"
          >
            <ScrollText size={16} />
            Historique
            {historyCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center bg-white/10 text-gray-300 text-[10px] font-bold rounded-full px-1.5">
                {historyCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowScheduled(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm font-medium"
          >
            <CalendarClock size={16} />
            Programmees
            {scheduledCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center bg-purple-500/30 text-purple-300 text-[10px] font-bold rounded-full px-1.5">
                {scheduledCount}
              </span>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* ── MOBILE: Single column (3 tabs) ── */}
        {/* ══════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto md:hidden p-3 pb-20 space-y-3">
          {/* Scanner button for ready tab */}
          {activeTab === "pretes" && readyCount > 0 && (
            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white font-bold min-h-[44px] py-3 rounded-xl transition-all"
            >
              <ScanLine size={16} /> Scanner QR
            </button>
          )}

          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              {activeTab === "nouvelles" && <Bell size={40} className="text-gray-700" />}
              {activeTab === "en-cours" && <ChefHat size={40} className="text-gray-700" />}
              {activeTab === "pretes" && <CheckCircle size={40} className="text-gray-700" />}
              <p className="text-gray-600 text-sm">
                {activeTab === "nouvelles" && "Aucune nouvelle commande"}
                {activeTab === "en-cours" && "Aucune commande en cours"}
                {activeTab === "pretes" && "Aucune commande prete"}
              </p>
            </div>
          ) : (
            activeOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                shopName={shopName}
                shopPrepTime={shopPrepTime}
                onAction={handleAction}
                onStockIssue={setStockIssueOrder}
                onView={handleViewOrder}
                onAdjustPrice={setAdjustPriceOrder}
              />
            ))
          )}
        </div>

        {/* ── Mobile bottom bar (Historique + Programmées) ── */}
        <div className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-zinc-900 border-t border-zinc-800 flex items-center justify-center gap-3 px-4 z-40">
          <button
            onClick={() => setShowHistory(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
          >
            <ScrollText size={14} />
            Historique
            {historyCount > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-white/10 text-gray-300 text-[9px] font-bold rounded-full px-1">
                {historyCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowScheduled(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
          >
            <CalendarClock size={14} />
            Programmees
            {scheduledCount > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-purple-500/30 text-purple-300 text-[9px] font-bold rounded-full px-1">
                {scheduledCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* ── HISTORY DRAWER (slide-up) ── */}
      {/* ══════════════════════════════════════════ */}
      {showHistory && (
        <div className="fixed inset-0 z-[70]" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 inset-x-0 h-[70vh] bg-[#111] border-t border-white/10 rounded-t-2xl flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + Header */}
            <div className="shrink-0 pt-3 pb-2 px-5">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScrollText size={16} className="text-gray-400" />
                  <h3 className="text-base font-bold text-white">Historique</h3>
                  <span className="text-xs text-gray-500">3 derniers jours</span>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
              {historyOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ScrollText size={32} className="text-gray-700" />
                  <p className="text-gray-600 text-sm">Aucune commande recente</p>
                </div>
              ) : (
                historyOrders.map((order) => (
                  <HistoryCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── SCHEDULED DRAWER (slide-up) ── */}
      {/* ══════════════════════════════════════════ */}
      {showScheduled && (
        <div className="fixed inset-0 z-[70]" onClick={() => setShowScheduled(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 inset-x-0 h-[70vh] bg-[#111] border-t border-white/10 rounded-t-2xl flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + Header */}
            <div className="shrink-0 pt-3 pb-2 px-5">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock size={16} className="text-purple-400" />
                  <h3 className="text-base font-bold text-white">Programmees</h3>
                </div>
                <button
                  onClick={() => setShowScheduled(false)}
                  className="text-gray-500 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
              {scheduledOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <CalendarClock size={32} className="text-gray-700" />
                  <p className="text-gray-600 text-sm">Aucune commande programmee</p>
                </div>
              ) : (
                scheduledOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    shopName={shopName}
                    shopPrepTime={shopPrepTime}
                    onAction={handleAction}
                    onStockIssue={setStockIssueOrder}
                    onView={handleViewOrder}
                    onAdjustPrice={setAdjustPriceOrder}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Desktop column component (active orders)
// ─────────────────────────────────────────────
function KitchenColumn({
  title,
  count,
  icon,
  color,
  orders,
  shopName,
  shopPrepTime,
  onAction,
  onStockIssue,
  onView,
  onAdjustPrice,
  emptyMessage,
  emptyIcon,
  extra,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: "amber" | "blue" | "emerald";
  orders: KitchenOrder[];
  shopName: string;
  shopPrepTime: number;
  onAction: (orderId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  onStockIssue: (order: KitchenOrder) => void;
  onView?: (orderId: string) => void;
  onAdjustPrice?: (order: KitchenOrder) => void;
  emptyMessage: string;
  emptyIcon: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const colorMap = {
    amber: "text-amber-400 bg-amber-500/20",
    blue: "text-blue-400 bg-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/20",
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Column header */}
      <div className="shrink-0 px-4 py-3 bg-[#111] border-b border-white/5 flex items-center gap-2">
        <div className={`${colorMap[color]} p-1.5 rounded-lg`}>{icon}</div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {count > 0 && (
          <span
            className={`min-w-[22px] h-[22px] flex items-center justify-center text-[11px] font-bold rounded-full px-1.5 ${
              color === "amber"
                ? "bg-amber-500 text-white"
                : color === "blue"
                ? "bg-blue-500 text-white"
                : "bg-emerald-500 text-white"
            }`}
          >
            {count}
          </span>
        )}
      </div>

      {/* Column content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {extra}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            {emptyIcon}
            <p className="text-gray-600 text-sm">{emptyMessage}</p>
          </div>
        ) : (
          orders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              shopName={shopName}
              shopPrepTime={shopPrepTime}
              onAction={onAction}
              onStockIssue={onStockIssue}
              onView={onView}
              onAdjustPrice={onAdjustPrice}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// History card (read-only, compact)
// ─────────────────────────────────────────────
function HistoryCard({ order }: { order: KitchenOrder }) {
  const badge = STATUS_BADGE[order.status] || {
    label: order.status,
    color: "bg-gray-500/20 text-gray-400",
    icon: Clock,
  };
  const BadgeIcon = badge.icon;

  const clientName = order.user
    ? `${order.user.firstName} ${order.user.lastName.charAt(0)}.`
    : "Client";

  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
      {/* Header row */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-base text-white">
            {ticketNumber}
          </span>
          <span className="text-sm text-gray-400">{clientName}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${badge.color}`}>
            <BadgeIcon size={10} />
            {badge.label}
          </span>
        </div>
        <span className="text-sm font-bold text-white shrink-0 ml-2">
          {formatPrice(order.totalCents)}
        </span>
      </div>

      {/* Details row */}
      <div className="px-4 pb-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>{itemCount} article{itemCount > 1 ? "s" : ""}</span>
        </div>
        <span className="text-gray-600">{formatDate(order.updatedAt)}</span>
      </div>
    </div>
  );
}
