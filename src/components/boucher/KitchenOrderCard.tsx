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
  Ban,
} from "lucide-react";
import PrepTimer from "./PrepTimer";
import { printOrderTicket } from "./OrderTicket";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { ORDER_STATUS_BORDER } from "@/lib/design-tokens";
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
  return "bg-purple-500/20 text-purple-400 border-purple-500/30";
}

// Status border colors imported from design-tokens

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
      <div className="bg-[#1a1a1a] rounded-xl border-l-4 border-l-purple-500 border border-white/5 px-4 py-3 opacity-75">
        {/* Main row: #number  Name  |  Retrait HH:MM  countdown  🖨 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-black text-xl text-white shrink-0">{ticketNumber}</span>
            <span className="text-base font-medium text-gray-400 truncate">{clientName}</span>
            {order.isPro && (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded shrink-0">PRO</span>
            )}
            {isFidele && (
              <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded shrink-0">FIDÈLE</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-purple-300">
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
        className={`bg-[#1a1a1a] rounded-2xl border-t-4 ${isScheduled ? "border-t-amber-500" : ORDER_STATUS_BORDER["PENDING"]} border border-white/5 overflow-hidden`}
      >
        {/* Orange banner for scheduled orders */}
        {isScheduled && pickupTime && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-5 py-3 flex items-center gap-2">
            <CalendarClock size={18} className="text-amber-400 shrink-0" />
            <span className="text-base font-bold text-amber-300">
              PROGRAMMEE — Retrait a {pickupTime}
            </span>
          </div>
        )}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-black text-[36px] leading-none text-white tracking-tight">
                {ticketNumber}
              </span>
              <span className="text-[26px] font-bold text-gray-300 leading-none truncate">
                {clientName}
              </span>
              {order.isPro && (
                <span className="text-sm font-bold bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-md">
                  PRO
                </span>
              )}
              {isFidele && (
                <span className="text-sm font-bold bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-md">FIDÈLE</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-lg text-gray-500">
                {order.items.length} article{order.items.length > 1 ? "s" : ""}
              </span>
              <span className="text-xl font-bold text-white">{formatPrice(order.totalCents)}</span>
              {!isScheduled && (pickupTime || isAsap) && (
                <span className="text-lg font-bold text-amber-400">
                  <Clock size={16} className="inline mr-1" />{pickupTime || "Des que possible"}
                </span>
              )}
              <span className="text-base text-gray-600">{timeSince(order.createdAt)}</span>
            </div>
          </div>
          <button
            onClick={handleView}
            className="shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-8 py-4 rounded-2xl transition-all text-xl"
          >
            <Eye size={22} />
            VOIR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#1a1a1a] rounded-2xl border-t-4 ${ORDER_STATUS_BORDER[order.status] || "border-t-gray-600"} border border-white/5 overflow-hidden ${readyOver30 ? "ring-2 ring-amber-500/50 animate-pulse" : ""} ${isLate ? "ring-2 ring-red-500/50" : ""}`}
    >
      {/* ── Scheduled banner (expanded PENDING) ── */}
      {order.status === "PENDING" && isScheduled && pickupTime && (
        <div className="mx-5 mt-4 mb-2 px-4 py-3 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center gap-3">
          <CalendarClock size={20} className="text-amber-400 shrink-0" />
          <span className="text-lg font-bold text-amber-300">
            PROGRAMMEE — Retrait a {pickupTime}
          </span>
        </div>
      )}

      {/* ── Late badge ── */}
      {isLate && (
        <div className="mx-5 mt-4 mb-2 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center justify-center gap-2">
          <Timer size={20} className="text-red-400" />
          <span className="text-lg font-bold text-red-400">
            EN RETARD de {lateMinutes} min
          </span>
        </div>
      )}

      {/* ── Header: #047 · Prénom ── */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-black text-[42px] leading-none text-white tracking-tight">
              {ticketNumber}
            </span>
            <span className="text-[28px] font-bold text-gray-300 leading-none">
              {clientName}
            </span>
            {order.isPro && (
              <span className="text-sm font-bold bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-md">
                PRO
              </span>
            )}
            {isFidele && (
              <span className="text-sm font-bold bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-md">FIDÈLE</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {isScheduledSoon && pickupTime && (
              <span className="text-base font-bold bg-purple-500/20 text-purple-400 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <CalendarClock size={14} /> {pickupTime}
              </span>
            )}
            {!isScheduledSoon && (pickupTime || isAsap) && (
              <span className="text-xl font-bold text-amber-400">
                <Clock size={18} className="inline mr-1" /> {pickupTime ? `Retrait ${pickupTime}` : "Dès que possible"}
              </span>
            )}
            {customerNum && (
              <span className="text-base text-gray-500">Client {customerNum}</span>
            )}
            {order.user?.phone && (
              <a href={`tel:${order.user.phone}`} className="flex items-center gap-1.5 text-base text-blue-400 hover:text-blue-300 transition-colors">
                <Phone size={16} /> {order.user.phone}
              </a>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <span className="text-base text-gray-500">
            <Clock size={14} className="inline mr-1" />
            {formatTime(order.createdAt)}
          </span>
          {order.status === "PENDING" && (
            <span className="text-sm text-gray-600">
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
        <div className="mx-5 mb-3 px-4 py-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-center">
          <span className="text-base font-bold text-amber-400">
            En attente depuis {waitMinutes} min
          </span>
        </div>
      )}

      {/* ── Items list ── */}
      <div className="px-5 pb-3">
        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 text-lg ${!item.available ? "opacity-40 line-through" : ""}`}
            >
              {item.product?.imageUrl && (
                <img
                  src={item.product.imageUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              )}
              <span className="text-gray-300 flex-1 min-w-0">
                <span className="text-white font-bold text-2xl">
                  {item.quantity}
                </span>{" "}
                {formatUnit(item.product?.unit || item.unit)} — <span className="font-medium text-white">{item.product?.name || item.name}</span>
                {(item.product?.unit === "TRANCHE" || item.unit === "TRANCHE") && item.sliceCount && (
                  <span className="ml-1 text-amber-400 text-sm">
                    ({item.sliceCount} tr.{item.sliceThickness ? ` ${item.sliceThickness}` : ""})
                  </span>
                )}
                {(item.product?.unit === "KG" || item.unit === "KG") && item.weightGrams && (
                  <span className="ml-1 text-blue-400 text-sm">({item.weightGrams}g)</span>
                )}
              </span>
              <span className="text-gray-500 text-base font-medium shrink-0 ml-2">
                {formatPrice(item.totalCents || item.priceCents * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Price adjustment badge ── */}
      {order.priceAdjustment?.status === "PENDING" && (
        <div className="mx-5 mb-3 px-4 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl">
          <p className="text-base font-bold text-amber-400 text-center">
            Ajustement en attente de validation client
          </p>
          <p className="text-sm text-amber-400/70 text-center mt-1">
            {formatPrice(order.priceAdjustment.originalTotal)} → {formatPrice(order.priceAdjustment.newTotal)}
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "AUTO_APPROVED" && (
        <div className="mx-5 mb-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-sm text-emerald-400 text-center">
            Prix ajuste automatiquement ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "APPROVED" && (
        <div className="mx-5 mb-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-sm text-emerald-400 text-center">
            Ajustement accepte par le client ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "REJECTED" && (
        <div className="mx-5 mb-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-sm text-red-400 text-center">
            Ajustement refuse par le client
          </p>
        </div>
      )}

      {/* ── Total ── */}
      <div className="px-5 pb-3 flex justify-between items-center">
        <span className="text-lg text-gray-500">Total</span>
        <span className="text-2xl font-bold text-white">{formatPrice(order.totalCents)}</span>
      </div>

      {/* ── Customer note ── */}
      {order.customerNote && (
        <div className="px-5 pb-3">
          <div className="bg-blue-500/10 rounded-xl px-4 py-3 flex items-start gap-2">
            <MessageSquare size={18} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-base text-blue-300">&quot;{order.customerNote}&quot;</p>
          </div>
        </div>
      )}

      {/* ── Requested time (only if not already shown in header pickup) ── */}
      {order.requestedTime && !pickupTime && !isAsap && (
        <div className="px-5 pb-3">
          <p className="text-sm text-gray-500">
            <Clock size={14} className="inline mr-1" />
            Retrait souhaité : {formatTime(order.requestedTime)}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── ACTIONS by status ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="px-5 pb-5 pt-2 space-y-3">

        {/* ── PENDING (expanded): Accept / Deny ── */}
        {order.status === "PENDING" && !showAcceptForm && !showDenyForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={silentPrint}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
              >
                <Printer size={18} /> Ticket
              </button>
              <button
                onClick={() => setShowDenyForm(true)}
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
              >
                <XCircle size={20} /> Refuser
              </button>
              {/* Scheduled: accept directly (no time selector). ASAP: show time selector form */}
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
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                Accepter
              </button>
            </div>
          </div>
        )}

        {/* ── Accept form (prep time selector — ASAP orders only) ── */}
        {order.status === "PENDING" && showAcceptForm && !isScheduled && (
          <div className="bg-emerald-500/10 rounded-2xl p-5 space-y-4 border border-emerald-500/20">
            <p className="text-lg font-medium text-emerald-300">
              Delai de preparation
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setAcceptMinutes(m)}
                  className={`px-4 min-h-[52px] py-3 rounded-xl text-lg font-bold transition-all ${
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
                className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-lg text-center"
                min={1}
                max={480}
              />
              <span className="text-lg text-gray-500">min</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => doAction("accept", { estimatedMinutes: acceptMinutes })}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-2xl transition-all text-xl disabled:opacity-50"
              >
                {loading ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
                CONFIRMER LA COMMANDE
              </button>
              <button
                onClick={() => setShowAcceptForm(false)}
                className="px-5 py-4 rounded-2xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-lg"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── Deny form ── */}
        {order.status === "PENDING" && showDenyForm && (
          <div className="bg-red-500/10 rounded-2xl p-5 space-y-4 border border-red-500/20">
            <p className="text-lg font-medium text-red-300">Raison du refus</p>
            <div className="flex flex-wrap gap-2">
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
                  className={`px-3.5 py-2.5 rounded-xl text-base font-medium transition-all ${
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
              placeholder="Ou saisissez une raison personnalisee..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base resize-none focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder-gray-600"
              rows={2}
            />
            <div className="flex gap-3">
              <button
                onClick={() => doAction("deny", { reason: denyReason })}
                disabled={loading || !denyReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition-all text-lg disabled:opacity-50"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <XCircle size={20} />}
                Confirmer le refus
              </button>
              <button
                onClick={() => { setShowDenyForm(false); setDenyReason(""); }}
                className="px-5 py-4 rounded-2xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-lg"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── ACCEPTED: Start preparing / Mark ready / Adjust price ── */}
        {order.status === "ACCEPTED" && (
          <div className="space-y-3">
            {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
              <button
                onClick={() => onAdjustPrice(order)}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-lg"
              >
                <DollarSign size={20} /> Ajuster le prix
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => doAction("start_preparing")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <ChefHat size={20} />}
                En préparation
              </button>
              <button
                onClick={() => doAction("mark_ready")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
              >
                <CheckCircle size={20} /> Prête !
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
              >
                <Timer size={16} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
              >
                <Timer size={16} /> +10 min
              </button>
              <button
                onClick={silentPrint}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
              >
                <Printer size={16} /> Ticket
              </button>
            </div>
          </div>
        )}

        {/* ── PREPARING: Mark ready / Add time / Adjust price ── */}
        {order.status === "PREPARING" && (
          <div className="space-y-3">
            {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
              <button
                onClick={() => onAdjustPrice(order)}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-lg"
              >
                <DollarSign size={20} /> Ajuster le prix
              </button>
            )}
            <button
              onClick={() => doAction("mark_ready")}
              disabled={loading || order.priceAdjustment?.status === "PENDING"}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-5 rounded-2xl transition-all text-xl disabled:opacity-50"
            >
              {loading ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
              Commande prête !
            </button>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
              >
                <Timer size={16} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
              >
                <Timer size={16} /> +10 min
              </button>
              <button
                onClick={silentPrint}
                className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
              >
                <Printer size={16} /> Ticket
              </button>
            </div>
          </div>
        )}

        {/* ── READY: Remis au client ── */}
        {order.status === "READY" && (
          <div className="space-y-3">
            <button
              onClick={() => {
                if (!order.qrCode) {
                  doAction("manual_pickup");
                  return;
                }
                doAction("confirm_pickup", { qrCode: order.qrCode });
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-5 rounded-2xl transition-all text-xl disabled:opacity-50"
            >
              {loading ? <Loader2 size={22} className="animate-spin" /> : <Package size={22} />}
              Remis au client
            </button>
            <button
              onClick={silentPrint}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[52px] py-3 rounded-xl text-base font-medium transition-all"
            >
              <Printer size={16} /> Imprimer le ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
