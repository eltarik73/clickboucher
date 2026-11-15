// /boucher/commandes — mode cuisine: full-screen tablet interface, dark theme, big buttons, audio
// alerts. Desktop: Nouvelles | En cours | Prêtes columns and a history drawer; mobile: 4 tabs.
// Scheduled orders arrive in Nouvelles as PENDING, wait in « Précommandes » once accepted and move up
// to « À préparer maintenant » 30 min before pickup, with a sound and a notification.
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useKitchenNotifications } from "@/hooks/use-kitchen-notifications";
import { useOrderPolling, type KitchenOrder } from "@/hooks/use-order-polling";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { formatTime } from "@/lib/format-kitchen";
import { startOrderAlert, stopOrderAlert } from "@/lib/sounds";
import HistoryDrawer from "./HistoryDrawer";
import KitchenBanners from "./KitchenBanners";
import KitchenDesktopBoard from "./KitchenDesktopBoard";
import KitchenMobileBoard from "./KitchenMobileBoard";
import KitchenTabs, { type KitchenTab } from "./KitchenTabs";
import KitchenTopBar from "./KitchenTopBar";
import PauseModal from "./PauseModal";
import { useConnectionStatus } from "./use-connection-status";
import { useOrderActions } from "./use-order-actions";
import { useShopStatus } from "./use-shop-status";

// Lazy-load: conditionally displayed (modals, overlays, scanner)
const AudioUnlockScreen = dynamic(() => import("@/components/boucher/AudioUnlockScreen"), {
  ssr: false,
});
const OrderAlertOverlay = dynamic(() => import("@/components/boucher/OrderAlertOverlay"), {
  ssr: false,
});
const ItemUnavailableModal = dynamic(() => import("@/components/boucher/ItemUnavailableModal"), {
  ssr: false,
});
const PriceAdjustModal = dynamic(() => import("@/components/boucher/PriceAdjustModal"), {
  ssr: false,
});
const QRScanner = dynamic(() => import("@/components/boucher/QRScanner").then((m) => m.QRScanner), {
  ssr: false,
});

export default function KitchenModePage() {
  // Audio unlock state (persisted per session by AudioUnlockScreen), null until mounted
  const [audioUnlocked, setAudioUnlocked] = useStoredFlag("session", "audioUnlocked");
  const shop = useShopStatus();
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [alertOrder, setAlertOrder] = useState<KitchenOrder | null>(null);
  // Active tab (mobile) — desktop uses multi-column layout
  const [activeTab, setActiveTab] = useState<KitchenTab>("en-cours");
  const [stockIssueOrder, setStockIssueOrder] = useState<KitchenOrder | null>(null);
  const [adjustPriceOrder, setAdjustPriceOrder] = useState<KitchenOrder | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  // Simple mode (2 columns: Nouvelles | Pretes, no En cours)
  const [storedSimpleMode, setSimpleMode] = useStoredFlag("local", "klikgo-simple-mode");
  const simpleMode = storedSimpleMode ?? false;
  // Wake Lock — keep screen on in kitchen mode
  const { supported: wakeLockSupported } = useWakeLock();
  // Track seen order IDs (orders the boucher has already clicked VOIR on)
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  // Ref for browser notification function (set after useKitchenNotifications)
  const sendNotificationRef = useRef<((order: KitchenOrder) => void) | null>(null);

  // Overlay, tab, sound (loops until an action, unless muted) and browser notification
  const raiseAlert = (order: KitchenOrder, tab: KitchenTab) => {
    setAlertOrder(order);
    setActiveTab(tab);
    if (!mutedRef.current) startOrderAlert();
    sendNotificationRef.current?.(order);
  };

  const {
    orders,
    loading,
    pendingOrders,
    inProgressOrders,
    readyOrders,
    historyOrders,
    pendingCount,
    inProgressCount,
    readyCount,
    historyCount,
    refetch,
    refreshHistory,
    authExpired,
    lastSuccessAt,
    activeTruncated,
  } = useOrderPolling({
    intervalMs: 5000,
    onNewOrder: (order) => {
      // Skip sound for already-seen orders
      if (seenOrderIdsRef.current.has(order.id)) return;
      raiseAlert(order, "nouvelles");
    },
    // Refresh shop status on any change
    onStatusChange: () => {
      shop.refresh();
    },
    onScheduledReady: (order) => {
      // Scheduled order entered 30-min window → moves up to "À préparer maintenant" in En cours
      const pickupTime = order.pickupSlotStart ? formatTime(order.pickupSlotStart) : "";
      const ticketNum = order.displayNumber || `#${order.orderNumber}`;
      raiseAlert(order, "en-cours");
      toast.info(`⏰ ${ticketNum} a preparer — Retrait ${pickupTime}`);
      // Notify client via server endpoint
      fetch(`/api/orders/${order.id}/scheduled-notify`, { method: "POST" }).catch(() => {});
    },
  });
  const { handleAction, handleAdjustPrice } = useOrderActions(refetch);

  // Kitchen notifications — title blink, favicon badge, browser notifications
  const { sendOrderNotification } = useKitchenNotifications(pendingCount);
  sendNotificationRef.current = sendOrderNotification;

  const connected = useConnectionStatus(lastSuccessAt);

  // ── Stop the alert once nothing is pending, and when leaving the page ──
  useEffect(() => {
    if (pendingCount === 0) stopOrderAlert();
  }, [pendingCount]);
  useEffect(() => () => stopOrderAlert(), []);

  // ── Handle VOIR click: stop sound + mark as seen ──
  const handleViewOrder = useCallback((orderId: string) => {
    seenOrderIdsRef.current.add(orderId);
    stopOrderAlert();
    // Dismiss alert overlay if it's showing for this order
    setAlertOrder((prev) => (prev?.id === orderId ? null : prev));
  }, []);

  // ── Audio unlock screen (not before the session flag is read) ──
  if (audioUnlocked === false) {
    return <AudioUnlockScreen onUnlocked={() => setAudioUnlocked(true)} />;
  }

  // ── Loading state ──
  if (audioUnlocked === null || (loading && orders.length === 0)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#DC2626]" />
          <p className="text-sm text-gray-500">Chargement des commandes...</p>
        </div>
      </div>
    );
  }

  // History tab or drawer opened: re-read the finished orders now instead of waiting for the slow cadence
  const selectTab = (tab: KitchenTab) => {
    setActiveTab(tab);
    if (tab === "historique") refreshHistory();
  };
  const openHistoryDrawer = () => {
    setShowHistory(true);
    refreshHistory();
  };
  const toggleSimpleMode = () => {
    const next = !simpleMode;
    setSimpleMode(next);
    localStorage.setItem("klikgo-simple-mode", String(next));
  };

  const cardProps = {
    shopName: shop.name,
    shopPrepTime: shop.prepTimeMin,
    onAction: handleAction,
    onStockIssue: setStockIssueOrder,
    onView: handleViewOrder,
  };

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
          onConfirm={(orderId, itemIds) =>
            handleAction(orderId, { action: "item_unavailable", itemIds })
          }
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-[#1a1a1a] p-5">
            <h3 className="text-base font-bold text-white">Scanner QR de retrait</h3>
            <QRScanner
              onClose={() => setShowScanner(false)}
              onScanned={() => {
                setShowScanner(false);
                refetch();
              }}
            />
            <button
              onClick={() => setShowScanner(false)}
              className="min-h-[44px] w-full rounded-xl bg-white/5 py-2.5 text-sm text-gray-500 transition-all hover:bg-white/10 dark:text-gray-400"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── Pause modal (v3 — cards sélectionnables) ── */}
      {showPauseModal && (
        <PauseModal
          onClose={() => setShowPauseModal(false)}
          onConfirm={(durationMin) => {
            setShowPauseModal(false);
            shop.setStatus({ action: "pause", reason: "Pause manuelle", durationMin });
          }}
        />
      )}

      {/* ── KITCHEN INTERFACE ── */}
      <div className="fixed inset-0 flex flex-col bg-[#0a0a0a]">
        <KitchenTopBar
          shop={shop}
          onOpenPause={() => setShowPauseModal(true)}
          muted={muted}
          onToggleMuted={() => setMuted(!muted)}
          simpleMode={simpleMode}
          onToggleSimpleMode={toggleSimpleMode}
          onOpenScanner={() => setShowScanner(true)}
          connected={connected}
        />
        <KitchenBanners
          authExpired={authExpired}
          activeTruncated={activeTruncated}
          shop={shop}
          wakeLockSupported={wakeLockSupported}
        />

        <KitchenTabs
          activeTab={activeTab}
          counts={{
            nouvelles: pendingCount,
            "en-cours": inProgressCount,
            pretes: readyCount,
            historique: historyCount,
          }}
          onSelect={selectTab}
        />
        <KitchenDesktopBoard
          simpleMode={simpleMode}
          pendingOrders={pendingOrders}
          inProgressOrders={inProgressOrders}
          readyOrders={readyOrders}
          historyCount={historyCount}
          {...cardProps}
          onAdjustPrice={setAdjustPriceOrder}
          onOpenScanner={() => setShowScanner(true)}
          onOpenHistory={openHistoryDrawer}
        />
        <KitchenMobileBoard
          activeTab={activeTab}
          pendingOrders={pendingOrders}
          inProgressOrders={inProgressOrders}
          readyOrders={readyOrders}
          historyOrders={historyOrders}
          {...cardProps}
          onAdjustPrice={setAdjustPriceOrder}
          onOpenScanner={() => setShowScanner(true)}
        />
      </div>

      {showHistory && (
        <HistoryDrawer orders={historyOrders} onClose={() => setShowHistory(false)} />
      )}
    </>
  );
}
