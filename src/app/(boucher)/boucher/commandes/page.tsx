// /boucher/commandes — MODE CUISINE (v10 — maquette v3)
// Full-screen tablet kitchen interface — dark theme, big buttons, audio alerts
// Tabs: Nouvelles | En cours | Prêtes | Historique
// "En cours" is split into 2 sections: "À préparer maintenant" + "Précommandes"
// Scheduled orders arrive in Nouvelles as PENDING, after accept go to En cours > Précommandes section
// 30 min before pickup → move up to "À préparer maintenant" section + sound + notification
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bell,
  ChefHat,
  CheckCircle,
  Loader2,
  Wifi,
  WifiOff,
  ScanLine,
  Volume2,
  VolumeX,
  ScrollText,
  CalendarClock,
  Package,
  XCircle,
  Ban,
  Clock,
  Settings,
  Pause,
  LayoutGrid,
} from "lucide-react";
// Logo uses <a> tag for dashboard navigation (no client-side nav needed)
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
type Tab = "nouvelles" | "en-cours" | "pretes" | "historique";
const THIRTY_MIN = 30 * 60 * 1000;

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
  PICKED_UP: { label: "Récupérée", color: "bg-emerald-500/20 text-emerald-400", icon: Package },
  COMPLETED: { label: "Terminée", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  DENIED: { label: "Refusée", color: "bg-red-500/20 text-red-400", icon: XCircle },
  CANCELLED: { label: "Annulée", color: "bg-red-500/20 text-red-400", icon: Ban },
  AUTO_CANCELLED: { label: "Expirée", color: "bg-gray-500/20 text-gray-500 dark:text-gray-400", icon: Ban },
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
  const [shopPauseEndsAt, setShopPauseEndsAt] = useState<string | null>(null);
  const [pauseCountdownStr, setPauseCountdownStr] = useState<string | null>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [selectedPauseDuration, setSelectedPauseDuration] = useState(15);

  // Alert overlay
  const [alertOrder, setAlertOrder] = useState<KitchenOrder | null>(null);

  // Active tab (mobile) — desktop uses multi-column layout
  const [activeTab, setActiveTab] = useState<Tab>("en-cours");

  // Modals
  const [stockIssueOrder, setStockIssueOrder] = useState<KitchenOrder | null>(null);
  const [adjustPriceOrder, setAdjustPriceOrder] = useState<KitchenOrder | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Bottom bar drawer
  const [showHistory, setShowHistory] = useState(false);

  // Sound muted
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Simple mode (2 columns: Nouvelles | Pretes, no En cours)
  const [simpleMode, setSimpleMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("klikgo-simple-mode") === "true";
    }
    return false;
  });

  // Connected indicator
  const [connected, setConnected] = useState(true);
  const lastFetchRef = useRef(Date.now());

  // Live clock (ticks every second)
  const [clockStr, setClockStr] = useState(() =>
    new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
  useEffect(() => {
    const tick = () =>
      setClockStr(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

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
    pendingCount,
    inProgressCount,
    readyCount,
    historyCount,
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
    onScheduledReady: (order) => {
      // Scheduled order entered 30-min window → moves up to "À préparer maintenant" in En cours
      const pickupTime = order.pickupSlotStart
        ? new Date(order.pickupSlotStart).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "";
      const ticketNum = order.displayNumber || `#${order.orderNumber}`;
      // Show alert overlay
      setAlertOrder(order);
      // Switch to En cours tab (mobile)
      setActiveTab("en-cours");
      // Play sound
      if (!mutedRef.current) {
        startOrderAlert();
      }
      // Send browser notification
      sendNotificationRef.current?.(order);
      // Toast
      toast.info(`⏰ ${ticketNum} a preparer — Retrait ${pickupTime}`);
      // Notify client via server endpoint
      fetch(`/api/orders/${order.id}/scheduled-notify`, { method: "POST" }).catch(() => {});
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
        setShopPauseEndsAt(json.data?.pauseEndsAt || null);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchShopInfo();
  }, [fetchShopInfo]);

  // ── Countdown for pause timer (1s tick for MM:SS) ──
  useEffect(() => {
    const tick = () => {
      if (shopPauseEndsAt) {
        const diffMs = new Date(shopPauseEndsAt).getTime() - Date.now();
        if (diffMs <= 0) {
          setPauseCountdownStr(null);
          fetchShopInfo();
        } else {
          const m = Math.floor(diffMs / 60000);
          const s = Math.floor((diffMs % 60000) / 1000);
          setPauseCountdownStr(`${m}:${s.toString().padStart(2, "0")}`);
        }
      } else {
        setPauseCountdownStr(null);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [shopPauseEndsAt, fetchShopInfo]);

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
          toast.success("Prix ajusté automatiquement (baisse)");
        } else {
          toast.success("Ajustement envoyé — en attente du client (5 min)");
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

  // Split inProgressOrders into: prepare now vs scheduled waiting
  const prepareNowOrders = inProgressOrders.filter((o) => {
    if (!o.pickupSlotStart) return true; // ASAP
    return new Date(o.pickupSlotStart).getTime() <= Date.now() + THIRTY_MIN;
  });
  const scheduledWaitingOrders = inProgressOrders
    .filter((o) => {
      if (!o.pickupSlotStart) return false;
      return new Date(o.pickupSlotStart).getTime() > Date.now() + THIRTY_MIN;
    })
    .sort((a, b) => new Date(a.pickupSlotStart!).getTime() - new Date(b.pickupSlotStart!).getTime());

  // Tab data — 4 tabs: Nouvelles | En cours | Prêtes | Historique
  const tabs: { key: Tab; label: string; shortLabel: string; count: number; icon: typeof Bell; color: string }[] = [
    { key: "nouvelles", label: "Nouvelles", shortLabel: "Nouv.", count: pendingCount, icon: Bell, color: "amber" },
    { key: "en-cours", label: "En cours", shortLabel: "En cours", count: inProgressCount, icon: ChefHat, color: "blue" },
    { key: "pretes", label: "Prêtes", shortLabel: "Prêtes", count: readyCount, icon: CheckCircle, color: "emerald" },
    { key: "historique", label: "Historique", shortLabel: "Histo.", count: historyCount, icon: ScrollText, color: "gray" as string },
  ];

  // Get orders for active tab (mobile)
  const activeOrders =
    activeTab === "nouvelles"
      ? pendingOrders
      : activeTab === "en-cours"
      ? inProgressOrders
      : activeTab === "pretes"
      ? readyOrders
      : historyOrders;

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
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-white/10 transition-all text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── Pause modal (v3 — cards sélectionnables) ── */}
      {showPauseModal && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onClick={() => setShowPauseModal(false)}>
          <div className="bg-[#1C1C1E] rounded-2xl max-w-sm w-full p-6 space-y-5 border border-[#3F3F46]" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "Outfit, sans-serif" }}>
            <div>
              <h3 className="text-white font-bold text-lg">Suspendre les commandes</h3>
              <p className="text-sm text-[#78716C] mt-1">Les clients verront que votre boutique est temporairement indisponible.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[15, 30, 60].map((min) => (
                <button
                  key={min}
                  onClick={() => setSelectedPauseDuration(min)}
                  className={`py-4 rounded-xl text-center transition-all border ${
                    selectedPauseDuration === min
                      ? "bg-[#F59E0B]/10 border-[#F59E0B] text-[#F59E0B]"
                      : "bg-white/5 border-[#3F3F46] text-gray-500 dark:text-gray-400 hover:bg-white/10"
                  }`}
                >
                  <span className="text-2xl font-bold block">{min}</span>
                  <span className="text-xs mt-0.5 block opacity-70">minutes</span>
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                setShowPauseModal(false);
                try {
                  const res = await fetch("/api/boucher/shop/status", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "pause", reason: "Pause manuelle", durationMin: selectedPauseDuration }),
                  });
                  if (res.ok) { fetchShopInfo(); toast.success(`Pause ${selectedPauseDuration} min`); }
                } catch { toast.error("Erreur"); }
              }}
              className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold py-3.5 rounded-xl transition-colors text-sm"
            >
              Suspendre pendant {selectedPauseDuration} min
            </button>
            <button
              onClick={() => setShowPauseModal(false)}
              className="w-full py-2.5 rounded-xl text-[#78716C] hover:text-white transition-colors text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── KITCHEN INTERFACE ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col">
        {/* ── Top bar (v3) ── */}
        <header className="shrink-0 bg-[#111] border-b border-white/5 px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Section gauche — Logo + Nom boutique */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <a href="/boucher/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-[24px] h-[24px] sm:w-[26px] sm:h-[26px] rounded-md bg-[#DC2626] flex items-center justify-center">
                <span className="text-white font-black text-[10px] sm:text-xs leading-none">K</span>
              </div>
              <span className="text-sm font-bold text-white hidden sm:inline">
                Klik<span className="text-[#DC2626]">&amp;</span>Go
              </span>
            </a>
            {shopName && (
              <>
                <div className="w-px h-5 bg-white/10 shrink-0 hidden sm:block" />
                <span className="text-xs text-[#78716C] truncate hidden sm:inline">{shopName}</span>
              </>
            )}
          </div>

          {/* Section centre — Contrôles */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Toggle En ligne / Hors ligne */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={async () => {
                  try {
                    const isOnline = shopStatus === "OPEN" || shopStatus === "BUSY";
                    const action = isOnline ? "close" : "resume";
                    const res = await fetch("/api/boucher/shop/status", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action }),
                    });
                    if (res.ok) {
                      fetchShopInfo();
                      toast.success(isOnline ? "Boutique hors ligne" : "Boutique en ligne");
                    }
                  } catch { toast.error("Erreur"); }
                }}
                className="relative w-9 h-5 sm:w-11 sm:h-6 rounded-full transition-colors duration-200 focus:outline-none"
                style={{ backgroundColor: shopStatus === "OPEN" || shopStatus === "BUSY" ? "#16A34A" : "#3F3F46" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ transform: shopStatus === "OPEN" || shopStatus === "BUSY" ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
              <div className="hidden sm:block">
                <span className={`text-xs font-bold ${shopStatus === "OPEN" || shopStatus === "BUSY" ? "text-[#16A34A]" : "text-[#78716C]"}`}>
                  {shopStatus === "OPEN" || shopStatus === "BUSY" ? "En ligne" : "Hors ligne"}
                </span>
                <span className="block text-[10px] text-[#57534E]">Auto 8h-19h</span>
              </div>
            </div>

            {/* Séparateur */}
            <div className="w-px h-5 sm:h-6 bg-[#262626] shrink-0" />

            {/* Bouton Pause */}
            {shopStatus === "PAUSED" ? (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/boucher/shop/status", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "resume" }),
                    });
                    if (res.ok) { fetchShopInfo(); toast.success("Boutique en ligne"); }
                  } catch { toast.error("Erreur"); }
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/30 transition-all min-h-[32px] sm:min-h-[36px] animate-pulse"
              >
                <Pause size={10} className="sm:w-3 sm:h-3" /> <span className="hidden sm:inline">{pauseCountdownStr || "En pause"}</span><span className="sm:hidden">{pauseCountdownStr || "Pause"}</span>
              </button>
            ) : (
              <button
                onClick={() => { setSelectedPauseDuration(15); setShowPauseModal(true); }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold bg-[#1C1C1E] text-[#F59E0B] border border-[#3F3F46] hover:bg-[#262626] transition-all min-h-[32px] sm:min-h-[36px]"
              >
                <Pause size={10} className="sm:w-3 sm:h-3" /> Pause
              </button>
            )}
          </div>

          {/* Section droite — Horloge + icônes */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Horloge */}
            <span className="text-xs sm:text-sm font-bold text-white tabular-nums lg:text-xl">
              {clockStr}
            </span>

            {/* Sound toggle */}
            <button
              onClick={() => setMuted(!muted)}
              className={`min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                muted ? "bg-red-500/20 text-red-400" : "bg-white/5 text-gray-500 dark:text-gray-400 hover:text-white"
              }`}
              title={muted ? "Son désactivé" : "Son activé"}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            {/* Simple mode toggle */}
            <button
              onClick={() => {
                const next = !simpleMode;
                setSimpleMode(next);
                localStorage.setItem("klikgo-simple-mode", String(next));
              }}
              className={`hidden sm:flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg transition-colors ${
                simpleMode ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-gray-500 dark:text-gray-400 hover:text-white"
              }`}
              title={simpleMode ? "Mode simple actif" : "Passer en mode simple"}
            >
              <LayoutGrid size={14} />
            </button>

            {/* QR Scanner — hidden on small phones, visible on tablets+ */}
            <button
              onClick={() => setShowScanner(true)}
              className="hidden sm:flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-white/5 text-gray-500 dark:text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Scanner QR"
            >
              <ScanLine size={16} />
            </button>

            {/* Connection status */}
            <div className="min-h-[32px] min-w-[24px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center">
              {connected ? (
                <Wifi size={12} className="text-emerald-400 sm:w-[14px] sm:h-[14px]" />
              ) : (
                <WifiOff size={12} className="text-red-400 animate-pulse sm:w-[14px] sm:h-[14px]" />
              )}
            </div>

            {/* Settings — hidden on small phones */}
            <a
              href="/boucher/parametres"
              className="hidden sm:flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-white/5 text-gray-500 dark:text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Parametres"
            >
              <Settings size={16} />
            </a>
          </div>
        </header>

        {/* ── PAUSE BANNER (v3 — fond discret, countdown) ── */}
        {shopStatus === "PAUSED" && (
          <div className="shrink-0 px-4 py-2 flex items-center justify-between gap-3" style={{ background: "rgba(245,158,11,0.1)", borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-sm font-bold text-[#F59E0B]">
              <Pause size={14} className="inline mr-1.5" />
              Commandes suspendues{pauseCountdownStr ? ` — reprise dans ${pauseCountdownStr}` : ""}
            </p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/boucher/shop/status", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "resume" }),
                  });
                  if (res.ok) { fetchShopInfo(); toast.success("Boutique en ligne"); }
                } catch { toast.error("Erreur"); }
              }}
              className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold rounded-lg transition-colors text-xs"
            >
              Reprendre
            </button>
          </div>
        )}

        {/* ── Wake Lock not supported warning ── */}
        {!wakeLockSupported && (
          <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center">
            <p className="text-[11px] text-amber-400">
              Désactivez la mise en veille dans les paramètres de votre tablette
            </p>
          </div>
        )}

        {/* ── Mobile/tablet tabs (lg-) ── */}
        <div className="lg:hidden shrink-0 bg-[#111] border-b border-white/5 px-2 py-1.5">
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
                  <span className="truncate">{tab.shortLabel}</span>
                  {tab.count > 0 && (
                    <span
                      className={`min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : tab.key === "nouvelles"
                          ? "bg-[#DC2626] text-white"
                          : "bg-white/10 text-gray-500 dark:text-gray-400"
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
        {/* ── DESKTOP: 3-column layout (40% / flex / 20%) ── */}
        {/* ══════════════════════════════════════════ */}
        <div className="flex-1 overflow-hidden hidden lg:flex pb-14">
          {/* Column 1: Nouvelles */}
          <div className={simpleMode ? "w-[50%] shrink-0" : "w-[40%] shrink-0"}>
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
          {!simpleMode && <div className="w-px bg-white/5 shrink-0" />}

          {/* Column 2: En cours (flex-1) — split: À préparer + Programmées en attente */}
          {/* Hidden in simple mode */}
          {!simpleMode && <div className="flex-1 min-w-0 flex flex-col h-full">
            {/* Column header */}
            <div className="shrink-0 px-3 py-2 bg-[#111] border-b border-white/5 flex items-center gap-1.5">
              <div className="text-blue-400 bg-blue-500/20 p-1 rounded-md"><ChefHat size={16} /></div>
              <h2 className="text-xs font-bold text-white">En cours</h2>
              {inProgressCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center text-[11px] font-bold rounded-full px-1 bg-blue-500 text-white">
                  {inProgressCount}
                </span>
              )}
            </div>

            {/* Scrollable content — always split into 2 sections */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {/* Section 1: À préparer maintenant — always visible */}
              <div className="flex items-center gap-2 px-1 pt-1">
                <div className={`w-2 h-2 rounded-full ${prepareNowOrders.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-gray-700"}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${prepareNowOrders.length > 0 ? "text-emerald-400" : "text-gray-600"}`}>
                  À PRÉPARER MAINTENANT
                </span>
                {prepareNowOrders.length > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">{prepareNowOrders.length}</span>
                )}
              </div>
              {prepareNowOrders.length > 0 ? (
                prepareNowOrders.map((order) => (
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
              ) : (
                <p className="text-xs text-gray-700 text-center py-3">Aucune commande à préparer</p>
              )}

              {/* Separator — always visible */}
              <div className="flex items-center gap-3 py-1.5">
                <div className="flex-1 h-px bg-[#1A1A1A]" />
                <CalendarClock size={13} className="text-[#F59E0B]/50" />
                <div className="flex-1 h-px bg-[#1A1A1A]" />
              </div>

              {/* Section 2: Précommandes — always visible */}
              <div className="flex items-center gap-2 px-1">
                <CalendarClock size={14} className={scheduledWaitingOrders.length > 0 ? "text-[#FBBF24]" : "text-gray-700"} />
                <span className={`text-xs font-bold uppercase tracking-wider ${scheduledWaitingOrders.length > 0 ? "text-[#FBBF24]" : "text-gray-600"}`}>
                  PRÉCOMMANDES
                </span>
                {scheduledWaitingOrders.length > 0 && (
                  <span className="text-[10px] font-bold bg-amber-500/20 text-[#FBBF24] px-1.5 py-0.5 rounded-full">{scheduledWaitingOrders.length}</span>
                )}
              </div>
              {scheduledWaitingOrders.length > 0 ? (
                scheduledWaitingOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    shopName={shopName}
                    shopPrepTime={shopPrepTime}
                    onAction={handleAction}
                    onStockIssue={setStockIssueOrder}
                    onView={handleViewOrder}
                  />
                ))
              ) : (
                <p className="text-xs text-gray-700 text-center py-3">Aucune commande programmée</p>
              )}
            </div>
          </div>}

          {/* Divider */}
          {!simpleMode && <div className="w-px bg-white/5 shrink-0" />}

          {/* Column 3: Prêtes (+ En cours in simple mode) */}
          <div className={simpleMode ? "w-[50%] shrink-0" : "w-1/5 shrink-0"}>
            <KitchenColumn
              title={simpleMode ? "En cours / Prêtes" : "Prêtes"}
              count={simpleMode ? inProgressCount + readyCount : readyCount}
              icon={<CheckCircle size={16} />}
              color="emerald"
              orders={simpleMode ? [...inProgressOrders, ...readyOrders] : readyOrders}
              shopName={shopName}
              shopPrepTime={shopPrepTime}
              onAction={handleAction}
              onStockIssue={setStockIssueOrder}
              onView={handleViewOrder}
              emptyMessage="Aucune commande prête"
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

        {/* ── Desktop bottom bar (Historique) ── */}
        <div className="hidden lg:flex fixed bottom-0 inset-x-0 h-14 bg-zinc-900 border-t border-zinc-800 items-center justify-center gap-4 px-6 z-40">
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
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* ── MOBILE: Single column (3 tabs) ── */}
        {/* ══════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto lg:hidden p-3 pb-4 space-y-1.5">
          {/* Scanner button for ready tab */}
          {activeTab === "pretes" && readyCount > 0 && (
            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white font-bold min-h-[44px] py-3 rounded-xl transition-all"
            >
              <ScanLine size={16} /> Scanner QR
            </button>
          )}

          {activeTab === "historique" ? (
            /* History tab — read-only compact cards */
            activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <ScrollText size={40} className="text-gray-700" />
                <p className="text-gray-600 text-sm">Aucune commande récente</p>
              </div>
            ) : (
              activeOrders.map((order) => (
                <HistoryCard key={order.id} order={order} />
              ))
            )
          ) : activeTab === "en-cours" ? (
            /* En cours tab — always split: À préparer + Précommandes */
            <>
              {/* Section 1: À préparer maintenant */}
              <div className="flex items-center gap-2 px-1 pt-1">
                <div className={`w-2 h-2 rounded-full ${prepareNowOrders.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-gray-700"}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${prepareNowOrders.length > 0 ? "text-emerald-400" : "text-gray-600"}`}>
                  À PRÉPARER MAINTENANT
                </span>
                {prepareNowOrders.length > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">{prepareNowOrders.length}</span>
                )}
              </div>
              {prepareNowOrders.length > 0 ? (
                prepareNowOrders.map((order) => (
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
              ) : (
                <p className="text-xs text-gray-700 text-center py-3">Aucune commande à préparer</p>
              )}

              {/* Separator */}
              <div className="flex items-center gap-3 py-1.5">
                <div className="flex-1 h-px bg-[#1A1A1A]" />
                <CalendarClock size={13} className="text-[#F59E0B]/50" />
                <div className="flex-1 h-px bg-[#1A1A1A]" />
              </div>

              {/* Section 2: Précommandes */}
              <div className="flex items-center gap-2 px-1">
                <CalendarClock size={14} className={scheduledWaitingOrders.length > 0 ? "text-[#FBBF24]" : "text-gray-700"} />
                <span className={`text-xs font-bold uppercase tracking-wider ${scheduledWaitingOrders.length > 0 ? "text-[#FBBF24]" : "text-gray-600"}`}>
                  PRÉCOMMANDES
                </span>
                {scheduledWaitingOrders.length > 0 && (
                  <span className="text-[10px] font-bold bg-amber-500/20 text-[#FBBF24] px-1.5 py-0.5 rounded-full">{scheduledWaitingOrders.length}</span>
                )}
              </div>
              {scheduledWaitingOrders.length > 0 ? (
                scheduledWaitingOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    shopName={shopName}
                    shopPrepTime={shopPrepTime}
                    onAction={handleAction}
                    onStockIssue={setStockIssueOrder}
                    onView={handleViewOrder}
                  />
                ))
              ) : (
                <p className="text-xs text-gray-700 text-center py-3">Aucune commande programmée</p>
              )}
            </>
          ) : activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              {activeTab === "nouvelles" && <Bell size={40} className="text-gray-700" />}
              {activeTab === "pretes" && <CheckCircle size={40} className="text-gray-700" />}
              <p className="text-gray-600 text-sm">
                {activeTab === "nouvelles" && "Aucune nouvelle commande"}
                {activeTab === "pretes" && "Aucune commande prête"}
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

        {/* Mobile bottom bar removed — Historique is now a tab */}
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* ── HISTORY DRAWER (slide-up) ── */}
      {/* ══════════════════════════════════════════ */}
      {showHistory && (
        <div className="fixed inset-0 z-[70]" role="presentation" onClick={() => setShowHistory(false)}>
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
                  <ScrollText size={16} className="text-gray-500 dark:text-gray-400" />
                  <h3 className="text-base font-bold text-white">Historique</h3>
                  <span className="text-xs text-gray-500">7 derniers jours</span>
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
                  <p className="text-gray-600 text-sm">Aucune commande récente</p>
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
  color: "amber" | "blue" | "emerald" | "purple" | "gray";
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
    purple: "text-purple-400 bg-purple-500/20",
    gray: "text-gray-500 dark:text-gray-400 bg-gray-500/20",
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Column header */}
      <div className="shrink-0 px-3 py-2 bg-[#111] border-b border-white/5 flex items-center gap-1.5">
        <div className={`${colorMap[color]} p-1 rounded-md`}>{icon}</div>
        <h2 className="text-xs font-bold text-white">{title}</h2>
        {count > 0 && (
          <span
            className={`min-w-[20px] h-5 flex items-center justify-center text-[11px] font-bold rounded-full px-1 ${
              color === "amber"
                ? "bg-amber-500 text-white"
                : color === "blue"
                ? "bg-blue-500 text-white"
                : color === "purple"
                ? "bg-purple-500 text-white"
                : color === "gray"
                ? "bg-gray-500 text-white"
                : "bg-emerald-500 text-white"
            }`}
          >
            {count}
          </span>
        )}
      </div>

      {/* Column content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
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
    color: "bg-gray-500/20 text-gray-500 dark:text-gray-400",
    icon: Clock,
  };
  const BadgeIcon = badge.icon;

  const clientName = order.user
    ? (order.user.firstName.charAt(0).toUpperCase() + order.user.firstName.slice(1).toLowerCase() + "." + order.user.lastName.charAt(0).toUpperCase())
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
          <span className="text-sm text-gray-500 dark:text-gray-400">{clientName}</span>
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
