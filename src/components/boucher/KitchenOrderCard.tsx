// KitchenOrderCard — Dark theme order card for kitchen mode (tablet-optimized)
// PENDING: compact by default, expand on VOIR (stops sound)
// Readable at 1 meter on a tablet
"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  ChefHat,
  Package,
  Timer,
  Printer,
  Loader2,
  MessageSquare,
  Clock,
  Eye,
  DollarSign,
  Phone,
  CalendarClock,
} from "lucide-react";
import PrepTimer from "./PrepTimer";
import { printOrderTicket } from "./OrderTicket";
import type { KitchenOrder } from "@/hooks/use-order-polling";
// ORDER_STATUS_BORDER removed in v3 — tickets use uniform border style
import { toast } from "sonner";

type Props = {
  order: KitchenOrder;
  shopName?: string;
  shopPrepTime?: number;
  onAction: (orderId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  onStockIssue: (order: KitchenOrder) => void;
  onView?: (orderId: string) => void;
  onAdjustPrice?: (order: KitchenOrder) => void;
};

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function formatUnit(unit: string) {
  return unit === "KG" ? "kg" : unit === "PIECE" ? "pc" : unit === "TRANCHE" ? "tr." : "barq.";
}

function isAsapTime(timeStr: string | null): boolean {
  if (!timeStr) return false;
  return timeStr.toLowerCase() === "asap";
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Maintenant";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `Dans ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `Dans ${h}h${String(m).padStart(2, "0")}` : `Dans ${h}h`;
}

function formatClientName(firstName: string, lastName: string): string {
  if (!firstName) return "Client";
  const first = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : "";
  return lastInitial ? `${first}.${lastInitial}` : first;
}

function getCountdownColor(ms: number): string {
  const min = ms / 60_000;
  if (min <= 30) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (min <= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
}

// v3 ticket design constants
const CARD_BG = "bg-[#151515]";
const CARD_BORDER = "border border-[#222]";
const CARD_HOVER = "hover:border-[#333]";
const CARD_RADIUS = "rounded-xl"; // 12px

export default function KitchenOrderCard({
  order,
  shopName,
  shopPrepTime = 15,
  onAction,
  onStockIssue,
  onView,
  onAdjustPrice,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [acceptMinutes, setAcceptMinutes] = useState(shopPrepTime);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState("");

  const clientName = order.user
    ? formatClientName(order.user.firstName, order.user.lastName)
    : "Client";
  const isFidele = order.user?.loyaltyBadge === "FIDELE";

  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
  const customerNum = order.user?.customerNumber;

  // 30-min ready reminder
  const readySince = order.actualReady ? Date.now() - new Date(order.actualReady).getTime() : 0;
  const readyOver30 = order.status === "READY" && readySince > 30 * 60 * 1000;
  const waitMinutes = Math.round(readySince / 60_000);

  // Late detection: estimated ready passed for ACCEPTED/PREPARING
  const isLate = (order.status === "ACCEPTED" || order.status === "PREPARING")
    && order.estimatedReady
    && new Date(order.estimatedReady).getTime() < Date.now();
  const lateMinutes = isLate && order.estimatedReady
    ? Math.round((Date.now() - new Date(order.estimatedReady).getTime()) / 60_000)
    : 0;

  // Scheduled order detection
  const THIRTY_MIN = 30 * 60 * 1000;
  const isScheduled = !!order.pickupSlotStart && new Date(order.pickupSlotStart).getTime() > Date.now();
  const isScheduledFuture = isScheduled
    && new Date(order.pickupSlotStart!).getTime() > Date.now() + THIRTY_MIN
    && (order.status === "ACCEPTED" || order.status === "PREPARING");
  const isScheduledSoon = isScheduled
    && new Date(order.pickupSlotStart!).getTime() <= Date.now() + THIRTY_MIN
    && (order.status === "ACCEPTED" || order.status === "PREPARING");
  const scheduledMs = order.pickupSlotStart
    ? new Date(order.pickupSlotStart).getTime() - Date.now()
    : 0;

  // Pickup time display — "asap" is not a valid date, show "Dès que possible"
  const isAsap = isAsapTime(order.requestedTime);
  const pickupTime = order.pickupSlotStart
    ? formatTime(order.pickupSlotStart)
    : order.requestedTime && !isAsap
      ? formatTime(order.requestedTime)
      : null;

  /** Silent print: prints via hidden iframe, shows toast feedback */
  function silentPrint() {
    const ok = printOrderTicket(order, shopName);
    if (ok) {
      toast.success("Ticket imprime", { duration: 2000 });
    } else {
      toast.error("Impression echouee — utilisez Reimprimer", { duration: 4000 });
    }
  }

  async function doAction(action: string, data?: Record<string, unknown>) {
    setLoading(true);
    try {
      await onAction(order.id, action, data);
      // Auto-print 1 ticket silently on accept
      if (action === "accept") {
        silentPrint();
      }
      setShowAcceptForm(false);
      setShowDenyForm(false);
      setDenyReason("");
    } finally {
      setLoading(false);
    }
  }

  function handleView() {
    setExpanded(true);
    onView?.(order.id);
  }

  // ── SCHEDULED FUTURE COMPACT VIEW (>30min before pickup, no action buttons) ──
  if (isScheduledFuture) {
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
    return (
      <div className={`${CARD_BG} ${CARD_RADIUS} ${CARD_BORDER} ${CARD_HOVER} border-l-4 border-l-amber-500 px-3 py-2 opacity-70 transition-colors`}>
        {/* Main row: #number  Name  |  Retrait HH:MM  countdown  🖨 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-base text-white shrink-0">{ticketNumber}</span>
            <span className="text-sm font-medium text-gray-400 truncate">{clientName}</span>
            {order.isPro && (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded shrink-0">PRO</span>
            )}
            {isFidele && (
              <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded shrink-0">FIDÈLE</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-[#FBBF24]">
              <CalendarClock size={13} className="inline mr-1" />
              {pickupTime}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${getCountdownColor(scheduledMs)}`}>
              {formatCountdown(scheduledMs)}
            </span>
            <button
              onClick={silentPrint}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 transition-colors"
              title="Imprimer ticket"
            >
              <Printer size={14} />
            </button>
          </div>
        </div>
        {/* Subtle secondary line: items count + total + note preview */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
          <span>{itemCount} article{itemCount > 1 ? "s" : ""}</span>
          <span className="font-medium text-gray-500">{formatPrice(order.totalCents)}</span>
          {order.customerNote && (
            <span className="text-blue-400/50 truncate max-w-[200px]">&quot;{order.customerNote}&quot;</span>
          )}
        </div>
      </div>
    );
  }

  // ── PENDING COMPACT VIEW (not yet expanded) ──
  if (order.status === "PENDING" && !expanded) {
    return (
      <div
        className={`${CARD_BG} ${CARD_RADIUS} ${CARD_BORDER} ${CARD_HOVER} overflow-hidden transition-colors`}
      >
        {/* Orange banner for scheduled orders */}
        {isScheduled && pickupTime && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-3 py-2 flex items-center gap-1.5">
            <CalendarClock size={14} className="text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-amber-300">
              PROGRAMMEE — Retrait a {pickupTime}
            </span>
          </div>
        )}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-[800] text-lg leading-none text-white tracking-tight">
                {ticketNumber}
              </span>
              <span className="text-xs text-[#78716C] leading-none truncate">
                {clientName}
              </span>
              {order.isPro && (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              )}
              {isFidele && (
                <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">FIDÈLE</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                {order.items.length} article{order.items.length > 1 ? "s" : ""}
              </span>
              <span className="text-sm font-bold text-white">{formatPrice(order.totalCents)}</span>
              {!isScheduled && (pickupTime || isAsap) && (
                <span className="text-xs font-bold text-amber-400">
                  <Clock size={12} className="inline mr-0.5" />{pickupTime || "Des que possible"}
                </span>
              )}
              <span className="text-xs text-gray-600">{timeSince(order.createdAt)}</span>
            </div>
          </div>
          <button
            onClick={handleView}
            className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-2 rounded-xl transition-all text-sm"
          >
            <Eye size={16} />
            VOIR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${CARD_BG} ${CARD_RADIUS} ${CARD_BORDER} ${CARD_HOVER} overflow-hidden transition-colors ${readyOver30 ? "ring-2 ring-amber-500/50 animate-pulse" : ""} ${isLate ? "ring-2 ring-red-500/50" : ""}`}
    >
      {/* ── Scheduled banner (expanded PENDING) ── */}
      {order.status === "PENDING" && isScheduled && pickupTime && (
        <div className="mx-3 mt-2 mb-1 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-2">
          <CalendarClock size={14} className="text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-amber-300">
            PROGRAMMEE — Retrait a {pickupTime}
          </span>
        </div>
      )}

      {/* ── Late banner (v3) ── */}
      {isLate && (
        <div className="px-3 py-1.5 flex items-center justify-center gap-1.5" style={{ background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.15)" }}>
          <span className="text-[10px] font-bold text-[#EF4444]">
            EN RETARD de {lateMinutes} min
          </span>
        </div>
      )}

      {/* ── Header: #047 · Prénom ── */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-[800] text-lg leading-none text-white tracking-tight">
              {ticketNumber}
            </span>
            <span className="text-xs text-[#78716C] leading-none">
              {clientName}
            </span>
            {order.isPro && (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                PRO
              </span>
            )}
            {isFidele && (
              <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">FIDÈLE</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {isScheduledSoon && pickupTime && (
              <span className="text-[11px] font-bold bg-amber-500/10 text-[#FBBF24] px-2 py-0.5 rounded flex items-center gap-1">
                <CalendarClock size={11} /> {pickupTime}
              </span>
            )}
            {!isScheduledSoon && (pickupTime || isAsap) && (
              <span className="text-[11px] font-bold text-[#FBBF24]">
                <Clock size={11} className="inline mr-0.5" /> {pickupTime ? `Retrait ${pickupTime}` : "Des que possible"}
              </span>
            )}
            {customerNum && (
              <span className="text-xs text-gray-500">Client {customerNum}</span>
            )}
            {order.user?.phone && (
              <a href={`tel:${order.user.phone}`} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <Phone size={12} /> {order.user.phone}
              </a>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-0.5">
          <span className="text-[11px] text-[#57534E]">
            <Clock size={10} className="inline mr-0.5" />
            {formatTime(order.createdAt)}
          </span>
          {order.status === "PENDING" && (
            <span className="text-[10px] text-[#57534E]">
              {timeSince(order.createdAt)}
            </span>
          )}
          {(order.status === "ACCEPTED" || order.status === "PREPARING") && (
            <PrepTimer estimatedReady={order.estimatedReady} size="sm" />
          )}
        </div>
      </div>

      {/* ── 30min reminder badge ── */}
      {readyOver30 && (
        <div className="mx-3 mb-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-center">
          <span className="text-xs font-bold text-amber-400">
            En attente depuis {waitMinutes} min
          </span>
        </div>
      )}

      {/* ── Items list (v3) ── */}
      <div className="px-3 pb-1.5">
        <div className="space-y-1">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 ${!item.available ? "opacity-40 line-through" : ""}`}
            >
              {item.product?.imageUrl ? (
                <img
                  src={item.product.imageUrl}
                  alt=""
                  className="w-7 h-7 rounded-[6px] object-cover shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-[6px] bg-white/5 shrink-0" />
              )}
              <span className="flex-1 min-w-0 text-xs text-[#A8A29E]">
                <span className="text-white font-bold text-sm">
                  {item.quantity}
                </span>{" "}
                {formatUnit(item.product?.unit || item.unit)} — <span className="text-[#A8A29E]">{item.product?.name || item.name}</span>
                {(item.product?.unit === "TRANCHE" || item.unit === "TRANCHE") && item.sliceCount && (
                  <span className="ml-1 text-amber-400 text-[10px]">
                    ({item.sliceCount} tr.{item.sliceThickness ? ` ${item.sliceThickness}` : ""})
                  </span>
                )}
                {(item.product?.unit === "KG" || item.unit === "KG") && item.weightGrams && (
                  <span className="ml-1 text-blue-400 text-[10px]">({item.weightGrams}g)</span>
                )}
                {item.variant && (
                  <span className="ml-1 text-pink-400 text-[10px] font-bold">[{item.variant}]</span>
                )}
                {item.pieceCount && item.pieceLabel && (
                  <span className="ml-1 text-cyan-400 text-[10px]">({item.pieceCount} {item.pieceLabel})</span>
                )}
                {item.cutOption && <span className="ml-1 text-amber-400 text-[10px] font-bold">[{item.cutOption}]</span>}
              </span>
              <span className="text-[#57534E] text-xs shrink-0 ml-1">
                {formatPrice(item.totalCents || item.priceCents * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Price adjustment badge ── */}
      {order.priceAdjustment?.status === "PENDING" && (
        <div className="mx-3 mb-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg">
          <p className="text-xs font-bold text-amber-400 text-center">
            Ajustement en attente de validation client
          </p>
          <p className="text-[10px] text-amber-400/70 text-center mt-0.5">
            {formatPrice(order.priceAdjustment.originalTotal)} → {formatPrice(order.priceAdjustment.newTotal)}
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "AUTO_APPROVED" && (
        <div className="mx-3 mb-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-[10px] text-emerald-400 text-center">
            Prix ajuste ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "APPROVED" && (
        <div className="mx-3 mb-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-[10px] text-emerald-400 text-center">
            Accepte ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "REJECTED" && (
        <div className="mx-3 mb-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-[10px] text-red-400 text-center">
            Ajustement refuse
          </p>
        </div>
      )}

      {/* ── Total (v3 — subtle bg) ── */}
      <div className="mx-3 mb-1.5 px-3 py-1.5 flex justify-between items-center rounded-lg" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid #1A1A1A" }}>
        <span className="text-xs text-[#57534E]">Total</span>
        <span className="text-sm font-bold text-white">{formatPrice(order.totalCents)}</span>
      </div>

      {/* ── Customer note ── */}
      {order.customerNote && (
        <div className="px-3 pb-1.5">
          <div className="bg-blue-500/10 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
            <MessageSquare size={12} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">&quot;{order.customerNote}&quot;</p>
          </div>
        </div>
      )}

      {/* ── Requested time (only if not already shown in header pickup) ── */}
      {order.requestedTime && !pickupTime && !isAsap && (
        <div className="px-3 pb-1.5">
          <p className="text-[10px] text-gray-500">
            <Clock size={10} className="inline mr-0.5" />
            Retrait souhaité : {formatTime(order.requestedTime)}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── ACTIONS by status ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="px-3 pb-3 pt-1 space-y-1.5">

        {/* ── PENDING (expanded): Accept / Deny (v3 buttons) ── */}
        {order.status === "PENDING" && !showAcceptForm && !showDenyForm && (
          <div className="flex gap-1.5">
            <button
              onClick={silentPrint}
              className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 p-[9px] rounded-[9px] text-xs font-bold transition-all shrink-0"
            >
              <Printer size={13} />
            </button>
            <button
              onClick={() => setShowDenyForm(true)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1 bg-[#1C1C1E] hover:bg-[#262626] border border-[#333] text-[#EF4444] font-bold p-[9px] rounded-[9px] transition-all text-xs disabled:opacity-50"
            >
              <XCircle size={13} /> Refuser
            </button>
            <button
              onClick={() => {
                if (isScheduled) {
                  doAction("accept", { estimatedMinutes: 0 });
                } else {
                  setShowAcceptForm(true);
                  setAcceptMinutes(shopPrepTime);
                }
              }}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1 bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white font-bold p-[9px] rounded-[9px] transition-all text-xs disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              Accepter
            </button>
          </div>
        )}

        {/* ── Accept form (prep time selector — ASAP orders only) ── */}
        {order.status === "PENDING" && showAcceptForm && !isScheduled && (
          <div className="bg-emerald-500/10 rounded-xl p-3 space-y-2 border border-emerald-500/20">
            <p className="text-xs font-medium text-emerald-300">
              Delai de preparation
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setAcceptMinutes(m)}
                  className={`px-2.5 min-h-[36px] py-1.5 rounded-lg text-xs font-bold transition-all ${
                    acceptMinutes === m
                      ? "bg-emerald-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {m}
                </button>
              ))}
              <input
                type="number"
                value={acceptMinutes}
                onChange={(e) => setAcceptMinutes(Number(e.target.value))}
                className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center"
                min={1}
                max={480}
              />
              <span className="text-xs text-gray-500">min</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => doAction("accept", { estimatedMinutes: acceptMinutes })}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all text-xs disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                CONFIRMER
              </button>
              <button
                onClick={() => setShowAcceptForm(false)}
                className="px-3 py-2 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── Deny form ── */}
        {order.status === "PENDING" && showDenyForm && (
          <div className="bg-red-500/10 rounded-xl p-3 space-y-2 border border-red-500/20">
            <p className="text-xs font-medium text-red-300">Raison du refus</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Rupture de stock",
                "Fermeture exceptionnelle",
                "Commande trop importante",
                "Hors zone de retrait",
                "Problème technique",
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setDenyReason(reason)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    denyReason === reason
                      ? "bg-red-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Ou saisissez une raison..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder-gray-600"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={() => doAction("deny", { reason: denyReason })}
                disabled={loading || !denyReason.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-all text-xs disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Confirmer le refus
              </button>
              <button
                onClick={() => { setShowDenyForm(false); setDenyReason(""); }}
                className="px-3 py-2 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── ACCEPTED: Ajuster + Prête (v3 buttons) ── */}
        {order.status === "ACCEPTED" && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <button
                onClick={silentPrint}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 p-[9px] rounded-[9px] text-xs font-bold transition-all shrink-0"
              >
                <Printer size={13} />
              </button>
              {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
                <button
                  onClick={() => onAdjustPrice(order)}
                  className="flex-1 flex items-center justify-center gap-1 bg-[#92400E] hover:bg-[#78350F] text-[#FDE68A] font-bold p-[9px] rounded-[9px] transition-all text-xs"
                >
                  <DollarSign size={13} /> Ajuster
                </button>
              )}
              <button
                onClick={() => doAction("start_preparing")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex-1 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-300 font-bold p-[9px] rounded-[9px] transition-all text-xs disabled:opacity-50"
              >
                <ChefHat size={13} /> Preparer
              </button>
              <button
                onClick={() => doAction("mark_ready")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex-1 flex items-center justify-center gap-1 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white font-bold p-[9px] rounded-[9px] transition-all text-xs disabled:opacity-50"
              >
                <CheckCircle size={13} /> Prete
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-500 p-1.5 rounded-[9px] text-[10px] font-medium transition-all"
              >
                <Timer size={11} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-500 p-1.5 rounded-[9px] text-[10px] font-medium transition-all"
              >
                <Timer size={11} /> +10 min
              </button>
            </div>
          </div>
        )}

        {/* ── PREPARING: Ajuster + Prête (v3 buttons) ── */}
        {order.status === "PREPARING" && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <button
                onClick={silentPrint}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 p-[9px] rounded-[9px] text-xs font-bold transition-all shrink-0"
              >
                <Printer size={13} />
              </button>
              {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
                <button
                  onClick={() => onAdjustPrice(order)}
                  className="flex-1 flex items-center justify-center gap-1 bg-[#92400E] hover:bg-[#78350F] text-[#FDE68A] font-bold p-[9px] rounded-[9px] transition-all text-xs"
                >
                  <DollarSign size={13} /> Ajuster
                </button>
              )}
              <button
                onClick={() => doAction("mark_ready")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex-[2] flex items-center justify-center gap-1 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white font-bold p-[9px] rounded-[9px] transition-all text-xs disabled:opacity-50"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Prete !
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-500 p-1.5 rounded-[9px] text-[10px] font-medium transition-all"
              >
                <Timer size={11} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-500 p-1.5 rounded-[9px] text-[10px] font-medium transition-all"
              >
                <Timer size={11} /> +10 min
              </button>
            </div>
          </div>
        )}

        {/* ── READY: Récupérée (v3 button) ── */}
        {order.status === "READY" && (
          <div className="flex gap-1.5">
            <button
              onClick={silentPrint}
              className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 p-[9px] rounded-[9px] text-xs font-bold transition-all shrink-0"
            >
              <Printer size={13} />
            </button>
            <button
              onClick={() => {
                if (!order.qrCode) {
                  doAction("manual_pickup");
                  return;
                }
                doAction("confirm_pickup", { qrCode: order.qrCode });
              }}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white font-bold p-[9px] rounded-[9px] transition-all text-xs disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              Recuperee
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
