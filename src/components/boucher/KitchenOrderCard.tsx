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
import { formatItemQty, kitchenStoredLine, printOrderTicket } from "./OrderTicket";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { formatCustomerNumber } from "@/lib/order-number-format";
import { storedLineUnits } from "@/lib/pricing/line";
// ORDER_STATUS_BORDER removed in v3 — tickets use uniform border style
import { toast } from "sonner";
import {
  formatPriceCents as formatPrice,
  isAsapTime,
  formatTime,
  timeSince,
  formatCountdown,
  formatClientName,
} from "@/lib/format-kitchen";

type Props = {
  order: KitchenOrder;
  shopName?: string;
  shopPrepTime?: number;
  onAction: (orderId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  onStockIssue: (order: KitchenOrder) => void;
  onView?: (orderId: string) => void;
  onAdjustPrice?: (order: KitchenOrder) => void;
};

// Pure formatters extracted to @/lib/format-kitchen so they can be unit-tested
// in isolation and shared with OrderTicket.tsx (was duplicated before).

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
  const customerNum = formatCustomerNumber(order.customerNumber);

  // 30-min ready reminder
  const readySince = order.actualReady ? Date.now() - new Date(order.actualReady).getTime() : 0;
  const readyOver30 = order.status === "READY" && readySince > 30 * 60 * 1000;
  const waitMinutes = Math.round(readySince / 60_000);

  // Late detection: estimated ready passed for ACCEPTED/PREPARING
  const isLate =
    (order.status === "ACCEPTED" || order.status === "PREPARING") &&
    order.estimatedReady &&
    new Date(order.estimatedReady).getTime() < Date.now();
  const lateMinutes =
    isLate && order.estimatedReady
      ? Math.round((Date.now() - new Date(order.estimatedReady).getTime()) / 60_000)
      : 0;

  // Scheduled order detection
  const THIRTY_MIN = 30 * 60 * 1000;
  const isScheduled =
    !!order.pickupSlotStart && new Date(order.pickupSlotStart).getTime() > Date.now();
  const isScheduledFuture =
    isScheduled &&
    new Date(order.pickupSlotStart!).getTime() > Date.now() + THIRTY_MIN &&
    (order.status === "ACCEPTED" || order.status === "PREPARING");
  const isScheduledSoon =
    isScheduled &&
    new Date(order.pickupSlotStart!).getTime() <= Date.now() + THIRTY_MIN &&
    (order.status === "ACCEPTED" || order.status === "PREPARING");
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
    const itemCount = order.items.reduce((s, i) => s + storedLineUnits(kitchenStoredLine(i)), 0);
    return (
      <div
        className={`${CARD_BG} ${CARD_RADIUS} ${CARD_BORDER} ${CARD_HOVER} border-l-4 border-l-amber-500 px-3 py-2 opacity-70 transition-colors`}
      >
        {/* Main row: #number  Name  |  Retrait HH:MM  countdown  🖨 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-base font-black text-white">{ticketNumber}</span>
            <span className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
              {clientName}
            </span>
            {order.isPro && (
              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                PRO
              </span>
            )}
            {isFidele && (
              <span className="shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                FIDÈLE
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-bold text-[#FBBF24]">
              <CalendarClock size={13} className="mr-1 inline" />
              {pickupTime}
            </span>
            <span
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${getCountdownColor(scheduledMs)}`}
            >
              {formatCountdown(scheduledMs)}
            </span>
            <button
              onClick={silentPrint}
              className="rounded-lg bg-white/5 p-2 text-gray-500 transition-colors hover:bg-white/10"
              title="Imprimer ticket"
            >
              <Printer size={14} />
            </button>
          </div>
        </div>
        {/* Subtle secondary line: items count + total + note preview */}
        <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-600">
          <span>
            {itemCount} article{itemCount > 1 ? "s" : ""}
          </span>
          <span className="font-medium text-gray-500">{formatPrice(order.totalCents)}</span>
          {order.customerNote && (
            <span className="max-w-[200px] truncate text-blue-400/50">
              &quot;{order.customerNote}&quot;
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── PENDING COMPACT VIEW (not yet expanded) ──
  // Shows item preview (3 first items + "+N more") so the boucher can decide
  // what to prep without clicking VOIR. Click VOIR for the full detail view
  // with customer note + prep-time selector.
  if (order.status === "PENDING" && !expanded) {
    const PREVIEW_MAX = 3;
    const previewItems = order.items.slice(0, PREVIEW_MAX);
    const remainingCount = order.items.length - previewItems.length;

    return (
      <div
        className={`${CARD_BG} ${CARD_RADIUS} ${CARD_BORDER} ${CARD_HOVER} overflow-hidden transition-colors`}
      >
        {/* Orange banner for scheduled orders */}
        {isScheduled && pickupTime && (
          <div className="flex items-center gap-1.5 border-b border-amber-500/30 bg-amber-500/20 px-3 py-2">
            <CalendarClock size={14} className="shrink-0 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">
              PROGRAMMEE — Retrait a {pickupTime}
            </span>
          </div>
        )}
        <div className="px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-[800] leading-none tracking-tight text-white">
                  {ticketNumber}
                </span>
                <span className="truncate text-xs leading-none text-[#78716C]">{clientName}</span>
                {order.isPro && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    PRO
                  </span>
                )}
                {isFidele && (
                  <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                    FIDÈLE
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {order.items.length} article{order.items.length > 1 ? "s" : ""}
                </span>
                <span className="text-sm font-bold text-white">
                  {formatPrice(order.totalCents)}
                </span>
                {!isScheduled && (pickupTime || isAsap) && (
                  <span className="text-xs font-bold text-amber-400">
                    <Clock size={12} className="mr-0.5 inline" />
                    {pickupTime || `~${shopPrepTime} min`}
                  </span>
                )}
                <span className="text-xs text-gray-600">{timeSince(order.createdAt)}</span>
              </div>
            </div>
            <button
              onClick={handleView}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-700 active:scale-95"
            >
              <Eye size={16} />
              VOIR
            </button>
          </div>

          {/* ── Items preview (3 first items, then "+N more") ── */}
          <div className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2">
            {previewItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <span className="min-w-[28px] shrink-0 text-[13px] font-bold tabular-nums text-white">
                  {formatItemQty(item)}
                </span>
                <span className="flex-1 truncate text-[#D6D3D1]">
                  {item.product?.name || item.name}
                </span>
                {(item.product?.unit === "TRANCHE" || item.unit === "TRANCHE") &&
                  item.sliceCount && (
                    <span className="shrink-0 text-[10px] text-amber-400">
                      {item.sliceCount} tr.{item.sliceThickness ? ` ${item.sliceThickness}` : ""}
                    </span>
                  )}
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="pl-[36px] text-[11px] italic text-gray-500">
                + {remainingCount} autre{remainingCount > 1 ? "s" : ""} article
                {remainingCount > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${CARD_BG} ${CARD_RADIUS} ${CARD_BORDER} ${CARD_HOVER} overflow-hidden transition-colors ${readyOver30 ? "animate-pulse ring-2 ring-amber-500/50" : ""} ${isLate ? "ring-2 ring-red-500/50" : ""}`}
    >
      {/* ── Scheduled banner (expanded PENDING) ── */}
      {order.status === "PENDING" && isScheduled && pickupTime && (
        <div className="mx-3 mb-1 mt-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-2">
          <CalendarClock size={14} className="shrink-0 text-amber-400" />
          <span className="text-xs font-bold text-amber-300">
            PROGRAMMEE — Retrait a {pickupTime}
          </span>
        </div>
      )}

      {/* ── Late banner (v3) ── */}
      {isLate && (
        <div
          className="flex items-center justify-center gap-1.5 px-3 py-1.5"
          style={{
            background: "rgba(239,68,68,0.1)",
            borderBottom: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <span className="text-[10px] font-bold text-[#EF4444]">
            EN RETARD de {lateMinutes} min
          </span>
        </div>
      )}

      {/* ── Header: #047 · Prénom ── */}
      <div className="flex items-start justify-between px-3 pb-1.5 pt-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-[800] leading-none tracking-tight text-white">
              {ticketNumber}
            </span>
            <span className="text-xs leading-none text-[#78716C]">{clientName}</span>
            {order.isPro && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                PRO
              </span>
            )}
            {isFidele && (
              <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                FIDÈLE
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            {isScheduledSoon && pickupTime && (
              <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-[#FBBF24]">
                <CalendarClock size={11} /> {pickupTime}
              </span>
            )}
            {!isScheduledSoon && (pickupTime || isAsap) && (
              <span className="text-[11px] font-bold text-[#FBBF24]">
                <Clock size={11} className="mr-0.5 inline" />{" "}
                {pickupTime ? `Retrait ${pickupTime}` : "Des que possible"}
              </span>
            )}
            {customerNum && <span className="text-xs text-gray-500">Client {customerNum}</span>}
            {order.user?.phone && (
              <a
                href={`tel:${order.user.phone}`}
                className="flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
              >
                <Phone size={12} /> {order.user.phone}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[11px] text-[#57534E]">
            <Clock size={10} className="mr-0.5 inline" />
            {formatTime(order.createdAt)}
          </span>
          {order.status === "PENDING" && (
            <span className="text-[10px] text-[#57534E]">{timeSince(order.createdAt)}</span>
          )}
          {(order.status === "ACCEPTED" || order.status === "PREPARING") && (
            <PrepTimer estimatedReady={order.estimatedReady} size="sm" />
          )}
        </div>
      </div>

      {/* ── 30min reminder badge ── */}
      {readyOver30 && (
        <div className="mx-3 mb-1.5 rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-center">
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
              className={`flex items-center gap-2 ${!item.available ? "line-through opacity-40" : ""}`}
            >
              {item.product?.imageUrl ? (
                <img
                  src={item.product.imageUrl}
                  alt={item.product?.name || item.name}
                  className="h-7 w-7 shrink-0 rounded-[6px] object-cover"
                />
              ) : (
                <div className="h-7 w-7 shrink-0 rounded-[6px] bg-white/5" />
              )}
              <span className="min-w-0 flex-1 text-xs text-[#A8A29E]">
                <span className="text-sm font-bold text-white">{formatItemQty(item)}</span> —{" "}
                <span className="text-[#A8A29E]">{item.product?.name || item.name}</span>
                {(item.product?.unit === "TRANCHE" || item.unit === "TRANCHE") &&
                  item.sliceCount && (
                    <span className="ml-1 text-[10px] text-amber-400">
                      ({item.sliceCount} tr.{item.sliceThickness ? ` ${item.sliceThickness}` : ""})
                    </span>
                  )}
                {item.variant && (
                  <span className="ml-1 text-[10px] font-bold text-pink-400">[{item.variant}]</span>
                )}
                {item.pieceCount && item.pieceLabel && (
                  <span className="ml-1 text-[10px] text-cyan-400">
                    ({item.pieceCount} {item.pieceLabel})
                  </span>
                )}
                {item.cutOption && (
                  <span className="ml-1 text-[10px] font-bold text-amber-400">
                    [{item.cutOption}]
                  </span>
                )}
              </span>
              <span className="ml-1 shrink-0 text-xs text-[#57534E]">
                {formatPrice(item.totalCents)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Price adjustment badge ── */}
      {order.priceAdjustment?.status === "PENDING" && (
        <div className="mx-3 mb-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5">
          <p className="text-center text-xs font-bold text-amber-400">
            Ajustement en attente de validation client
          </p>
          <p className="mt-0.5 text-center text-[10px] text-amber-400/70">
            {formatPrice(order.priceAdjustment.originalTotal)} →{" "}
            {formatPrice(order.priceAdjustment.newTotal)}
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "AUTO_APPROVED" && (
        <div className="mx-3 mb-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
          <p className="text-center text-[10px] text-emerald-400">
            Prix ajuste ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "APPROVED" && (
        <div className="mx-3 mb-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
          <p className="text-center text-[10px] text-emerald-400">
            Accepte ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "REJECTED" && (
        <div className="mx-3 mb-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5">
          <p className="text-center text-[10px] text-red-400">Ajustement refuse</p>
        </div>
      )}

      {/* ── Total (v3 — subtle bg) ── */}
      <div
        className="mx-3 mb-1.5 flex items-center justify-between rounded-lg px-3 py-1.5"
        style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid #1A1A1A" }}
      >
        <span className="text-xs text-[#57534E]">Total</span>
        <span className="text-sm font-bold text-white">{formatPrice(order.totalCents)}</span>
      </div>

      {/* ── Customer note ── */}
      {order.customerNote && (
        <div className="px-3 pb-1.5">
          <div className="flex items-start gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1.5">
            <MessageSquare size={12} className="mt-0.5 shrink-0 text-blue-400" />
            <p className="text-xs text-blue-300">&quot;{order.customerNote}&quot;</p>
          </div>
        </div>
      )}

      {/* ── Requested time (only if not already shown in header pickup) ── */}
      {order.requestedTime && !pickupTime && !isAsap && (
        <div className="px-3 pb-1.5">
          <p className="text-[10px] text-gray-500">
            <Clock size={10} className="mr-0.5 inline" />
            Retrait souhaité : {formatTime(order.requestedTime)}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── ACTIONS by status ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="space-y-1.5 px-3 pb-3 pt-1">
        {/* ── PENDING (expanded): Accept / Deny (v3 buttons) ── */}
        {order.status === "PENDING" && !showAcceptForm && !showDenyForm && (
          <div className="flex gap-1.5">
            <button
              onClick={silentPrint}
              className="flex shrink-0 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-[9px] text-xs font-bold text-gray-500 transition-all hover:bg-white/10 dark:text-gray-400"
            >
              <Printer size={13} />
            </button>
            <button
              onClick={() => setShowDenyForm(true)}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1 rounded-[9px] border border-[#333] bg-[#1C1C1E] p-[9px] text-xs font-bold text-[#EF4444] transition-all hover:bg-[#262626] disabled:opacity-50"
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
              className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-[#16A34A] p-[9px] text-xs font-bold text-white transition-all hover:bg-[#15803D] active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              Accepter
            </button>
          </div>
        )}

        {/* ── Accept form (prep time selector — ASAP orders only) ── */}
        {order.status === "PENDING" && showAcceptForm && !isScheduled && (
          <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <p className="text-xs font-medium text-emerald-300">Delai de preparation</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setAcceptMinutes(m)}
                  className={`min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    acceptMinutes === m
                      ? "bg-emerald-600 text-white"
                      : "bg-white/5 text-gray-500 hover:bg-white/10 dark:text-gray-400"
                  }`}
                >
                  {m}
                </button>
              ))}
              <input
                type="number"
                value={acceptMinutes}
                onChange={(e) => setAcceptMinutes(Number(e.target.value))}
                className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-xs text-white"
                min={1}
                max={480}
                aria-label="Délai de préparation en minutes"
              />
              <span className="text-xs text-gray-500">min</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => doAction("accept", { estimatedMinutes: acceptMinutes })}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                CONFIRMER
              </button>
              <button
                onClick={() => setShowAcceptForm(false)}
                className="rounded-xl bg-white/5 px-3 py-2 text-xs text-gray-500 transition-all hover:bg-white/10 dark:text-gray-400"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── Deny form ── */}
        {order.status === "PENDING" && showDenyForm && (
          <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
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
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    denyReason === reason
                      ? "bg-red-600 text-white"
                      : "bg-white/5 text-gray-500 hover:bg-white/10 dark:text-gray-400"
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
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={() => doAction("deny", { reason: denyReason })}
                disabled={loading || !denyReason.trim()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Confirmer le refus
              </button>
              <button
                onClick={() => {
                  setShowDenyForm(false);
                  setDenyReason("");
                }}
                className="rounded-xl bg-white/5 px-3 py-2 text-xs text-gray-500 transition-all hover:bg-white/10 dark:text-gray-400"
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
                className="flex shrink-0 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-[9px] text-xs font-bold text-gray-500 transition-all hover:bg-white/10 dark:text-gray-400"
              >
                <Printer size={13} />
              </button>
              {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
                <button
                  onClick={() => onAdjustPrice(order)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-[#92400E] p-[9px] text-xs font-bold text-[#FDE68A] transition-all hover:bg-[#78350F]"
                >
                  <DollarSign size={13} /> Ajuster
                </button>
              )}
              <button
                onClick={() => doAction("start_preparing")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-[9px] text-xs font-bold text-gray-300 transition-all hover:bg-white/10 disabled:opacity-50"
              >
                <ChefHat size={13} /> Preparer
              </button>
              <button
                onClick={() => doAction("mark_ready")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-[#2563EB] p-[9px] text-xs font-bold text-white transition-all hover:bg-[#1D4ED8] active:scale-95 disabled:opacity-50"
              >
                <CheckCircle size={13} /> Prete
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-1.5 text-[10px] font-medium text-gray-500 transition-all hover:bg-white/10"
              >
                <Timer size={11} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-1.5 text-[10px] font-medium text-gray-500 transition-all hover:bg-white/10"
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
                className="flex shrink-0 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-[9px] text-xs font-bold text-gray-500 transition-all hover:bg-white/10 dark:text-gray-400"
              >
                <Printer size={13} />
              </button>
              {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
                <button
                  onClick={() => onAdjustPrice(order)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-[#92400E] p-[9px] text-xs font-bold text-[#FDE68A] transition-all hover:bg-[#78350F]"
                >
                  <DollarSign size={13} /> Ajuster
                </button>
              )}
              <button
                onClick={() => doAction("mark_ready")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex flex-[2] items-center justify-center gap-1 rounded-[9px] bg-[#2563EB] p-[9px] text-xs font-bold text-white transition-all hover:bg-[#1D4ED8] active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle size={13} />
                )}
                Prete !
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-1.5 text-[10px] font-medium text-gray-500 transition-all hover:bg-white/10"
              >
                <Timer size={11} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-1.5 text-[10px] font-medium text-gray-500 transition-all hover:bg-white/10"
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
              className="flex shrink-0 items-center justify-center gap-1 rounded-[9px] bg-white/5 p-[9px] text-xs font-bold text-gray-500 transition-all hover:bg-white/10 dark:text-gray-400"
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-[#16A34A] p-[9px] text-xs font-bold text-white transition-all hover:bg-[#15803D] active:scale-95 disabled:opacity-50"
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
