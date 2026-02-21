// /boucher/commandes — MODE CUISINE (v5)
// Full-screen tablet kitchen interface — dark theme, big buttons, audio alerts
// 5 tabs: Nouvelles, En cours, Pretes, Historique, Programmees
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
} from "lucide-react";
import Link from "next/link";
import { useOrderPolling, type KitchenOrder } from "@/hooks/use-order-polling";
import { soundManager } from "@/lib/notification-sound";
import { startOrderAlert, stopOrderAlert } from "@/lib/sounds";
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
const QRScanner = dynamic(
  () => import("@/components/boucher/QRScanner").then((m) => m.QRScanner),
  { ssr: false }
);
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Tab = "nouvelles" | "en-cours" | "pretes" | "historique" | "programmees";

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
  const [showScanner, setShowScanner] = useState(false);

  // Sound muted
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Connected indicator
  const [connected, setConnected] = useState(true);
  const lastFetchRef = useRef(Date.now());

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
      // Show alert overlay
      setAlertOrder(order);
      // Switch to "nouvelles" tab
      setActiveTab("nouvelles");
      // Play Marimba Song alert (loops until action, if not muted)
      if (!mutedRef.current) {
        startOrderAlert();
      }
    },
    onStatusChange: () => {
      // Refresh shop status on any change
      fetchShopInfo();
    },
  });

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

  // Tab data
  const tabs: { key: Tab; label: string; count: number; icon: typeof Bell }[] = [
    { key: "nouvelles", label: "Nouvelles", count: pendingCount, icon: Bell },
    { key: "en-cours", label: "En cours", count: inProgressCount, icon: ChefHat },
    { key: "pretes", label: "Pretes", count: readyCount, icon: CheckCircle },
    { key: "historique", label: "Historique", count: historyCount, icon: ScrollText },
    { key: "programmees", label: "Programmees", count: scheduledCount, icon: CalendarClock },
  ];

  // Get orders for active tab (mobile)
  const activeOrders =
    activeTab === "nouvelles"
      ? pendingOrders
      : activeTab === "en-cours"
      ? inProgressOrders
      : activeTab === "pretes"
      ? readyOrders
      : activeTab === "historique"
      ? historyOrders
      : scheduledOrders;

  return (
    <>
      {/* ── Alert overlay (new order) ── */}
      <OrderAlertOverlay
        order={alertOrder}
        onDismiss={() => setAlertOrder(null)}
      />

      {/* ── Stock issue modal ── */}
      {stockIssueOrder && (
        <ItemUnavailableModal
          order={stockIssueOrder}
          onClose={() => setStockIssueOrder(null)}
          onConfirm={handleStockIssue}
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
            {/* Shop status indicator */}
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                shopStatus === "OPEN"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : shopStatus === "BUSY"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {shopStatus === "OPEN" ? "En ligne" : shopStatus === "BUSY" ? "Occupe" : shopStatus}
            </span>

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
        {/* ── DESKTOP: Multi-column layout ── */}
        {/* ══════════════════════════════════════════ */}
        <div className="flex-1 overflow-hidden hidden md:flex">
          {/* Column 1: Nouvelles */}
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
            emptyMessage="Aucune nouvelle commande"
            emptyIcon={<Bell size={32} className="text-gray-700" />}
          />

          {/* Divider */}
          <div className="w-px bg-white/5 shrink-0" />

          {/* Column 2: En cours */}
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
            emptyMessage="Aucune commande en cours"
            emptyIcon={<ChefHat size={32} className="text-gray-700" />}
          />

          {/* Divider */}
          <div className="w-px bg-white/5 shrink-0" />

          {/* Column 3: Pretes */}
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

          {/* Divider */}
          <div className="w-px bg-white/5 shrink-0" />

          {/* Column 4: Historique */}
          <HistoryColumn
            title="Historique"
            count={historyCount}
            icon={<ScrollText size={16} />}
            orders={historyOrders}
            emptyMessage="Aucune commande recente"
            emptyIcon={<ScrollText size={32} className="text-gray-700" />}
          />

          {/* Divider */}
          <div className="w-px bg-white/5 shrink-0" />

          {/* Column 5: Programmees */}
          <ScheduledColumn
            title="Programmees"
            count={scheduledCount}
            icon={<CalendarClock size={16} />}
            orders={scheduledOrders}
            shopName={shopName}
            shopPrepTime={shopPrepTime}
            onAction={handleAction}
            onStockIssue={setStockIssueOrder}
            emptyMessage="Aucune commande programmee"
            emptyIcon={<CalendarClock size={32} className="text-gray-700" />}
          />
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* ── MOBILE: Single column (tabs) ── */}
        {/* ══════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto md:hidden p-3 space-y-3">
          {/* Scanner button for ready tab */}
          {activeTab === "pretes" && readyCount > 0 && (
            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white font-bold min-h-[44px] py-3 rounded-xl transition-all"
            >
              <ScanLine size={16} /> Scanner QR
            </button>
          )}

          {/* History tab — special read-only cards */}
          {activeTab === "historique" ? (
            historyOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <ScrollText size={40} className="text-gray-700" />
                <p className="text-gray-600 text-sm">Aucune commande recente</p>
                <p className="text-gray-700 text-xs">3 derniers jours</p>
              </div>
            ) : (
              historyOrders.map((order) => (
                <HistoryCard key={order.id} order={order} />
              ))
            )
          ) : activeTab === "programmees" ? (
            scheduledOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <CalendarClock size={40} className="text-gray-700" />
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
                />
              ))
            )
          ) : activeOrders.length === 0 ? (
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
              />
            ))
          )}
        </div>
      </div>
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
    <div className="flex-1 flex flex-col min-w-0">
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
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Desktop History column (read-only cards)
// ─────────────────────────────────────────────
function HistoryColumn({
  title,
  count,
  icon,
  orders,
  emptyMessage,
  emptyIcon,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  orders: KitchenOrder[];
  emptyMessage: string;
  emptyIcon: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Column header */}
      <div className="shrink-0 px-4 py-3 bg-[#111] border-b border-white/5 flex items-center gap-2">
        <div className="text-gray-400 bg-white/5 p-1.5 rounded-lg">{icon}</div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {count > 0 && (
          <span className="min-w-[22px] h-[22px] flex items-center justify-center text-[11px] font-bold rounded-full px-1.5 bg-white/10 text-gray-400">
            {count}
          </span>
        )}
        <span className="text-[10px] text-gray-600 ml-auto">3 jours</span>
      </div>

      {/* Column content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            {emptyIcon}
            <p className="text-gray-600 text-sm">{emptyMessage}</p>
          </div>
        ) : (
          orders.map((order) => (
            <HistoryCard key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Desktop Scheduled column (active order cards)
// ─────────────────────────────────────────────
function ScheduledColumn({
  title,
  count,
  icon,
  orders,
  shopName,
  shopPrepTime,
  onAction,
  onStockIssue,
  emptyMessage,
  emptyIcon,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  orders: KitchenOrder[];
  shopName: string;
  shopPrepTime: number;
  onAction: (orderId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  onStockIssue: (order: KitchenOrder) => void;
  emptyMessage: string;
  emptyIcon: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Column header */}
      <div className="shrink-0 px-4 py-3 bg-[#111] border-b border-white/5 flex items-center gap-2">
        <div className="text-purple-400 bg-purple-500/20 p-1.5 rounded-lg">{icon}</div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {count > 0 && (
          <span className="min-w-[22px] h-[22px] flex items-center justify-center text-[11px] font-bold rounded-full px-1.5 bg-purple-500 text-white">
            {count}
          </span>
        )}
      </div>

      {/* Column content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
