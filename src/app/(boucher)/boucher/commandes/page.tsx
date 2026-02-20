// /boucher/commandes — MODE CUISINE (v4)
// Full-screen tablet kitchen interface — dark theme, big buttons, audio alerts
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
} from "lucide-react";
import Link from "next/link";
import { useOrderPolling, type KitchenOrder } from "@/hooks/use-order-polling";
import { soundManager } from "@/lib/notification-sound";
import AudioUnlockScreen from "@/components/boucher/AudioUnlockScreen";
import OrderAlertOverlay from "@/components/boucher/OrderAlertOverlay";
import KitchenOrderCard from "@/components/boucher/KitchenOrderCard";
import ItemUnavailableModal from "@/components/boucher/ItemUnavailableModal";
import { QRScanner } from "@/components/boucher/QRScanner";
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

// ─────────────────────────────────────────────
// Main Kitchen Page
// ─────────────────────────────────────────────
export default function KitchenModePage() {
  // Audio unlock state
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Shop info
  const [shopName, setShopName] = useState("");
  const [shopPrepTime, setShopPrepTime] = useState(15);
  const [shopStatus, setShopStatus] = useState("OPEN");

  // Alert overlay
  const [alertOrder, setAlertOrder] = useState<KitchenOrder | null>(null);

  // Active tab (mobile) — desktop uses 3-column layout
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
    pendingCount,
    inProgressCount,
    readyCount,
    refetch,
  } = useOrderPolling({
    intervalMs: 5000,
    onNewOrder: (order) => {
      // Show alert overlay
      setAlertOrder(order);
      // Switch to "nouvelles" tab
      setActiveTab("nouvelles");
      // Play sound + vibrate (if not muted)
      if (!mutedRef.current) {
        soundManager.playNewOrderAlert();
        soundManager.vibrate();
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

  // ── Handle order action (unified API) ──
  async function handleAction(orderId: string, action: string, data?: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/boucher/orders/${orderId}/action`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      if (res.ok) {
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
              className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-sm"
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
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft size={16} />
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
              className={`p-2 rounded-lg transition-colors ${
                muted
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/5 text-gray-400 hover:text-white"
              }`}
              title={muted ? "Son desactive" : "Son active"}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* QR Scanner */}
            <button
              onClick={() => setShowScanner(true)}
              className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Scanner QR"
            >
              <ScanLine size={16} />
            </button>

            {/* Connection status */}
            <div className="flex items-center gap-1">
              {connected ? (
                <Wifi size={14} className="text-emerald-400" />
              ) : (
                <WifiOff size={14} className="text-red-400 animate-pulse" />
              )}
            </div>
          </div>
        </header>

        {/* ── Mobile tabs (md-) ── */}
        <div className="md:hidden shrink-0 bg-[#111] border-b border-white/5 px-2 py-1.5">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[#DC2626] text-white"
                      : "text-gray-500 hover:bg-white/5"
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
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
        {/* ── DESKTOP: 3-column layout ── */}
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
                  className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#b91c1c] active:scale-95 text-white font-bold py-3 rounded-xl transition-all mb-3"
                >
                  <ScanLine size={16} /> Scanner QR
                </button>
              ) : null
            }
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
              className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white font-bold py-3 rounded-xl transition-all"
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
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Desktop column component
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
