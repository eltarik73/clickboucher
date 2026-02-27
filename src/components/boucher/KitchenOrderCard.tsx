// KitchenOrderCard — Dark theme order card for kitchen mode
// PENDING: compact by default, expand on VOIR (stops sound)
// Shows #047 · Prénom in big text (28px), status-based action buttons
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
} from "lucide-react";
import PrepTimer from "./PrepTimer";
import { printOrderTicket } from "./OrderTicket";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { ORDER_STATUS_BORDER } from "@/lib/design-tokens";

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
    ? `${order.user.firstName} ${order.user.lastName.charAt(0)}.`
    : "Client";

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

  // Pickup time display
  const pickupTime = order.pickupSlotStart
    ? formatTime(order.pickupSlotStart)
    : order.requestedTime
      ? formatTime(order.requestedTime)
      : null;

  async function doAction(action: string, data?: Record<string, unknown>) {
    setLoading(true);
    try {
      await onAction(order.id, action, data);
      // Auto-print 2 tickets (CUISINE + CLIENT) on accept
      if (action === "accept") {
        printOrderTicket(order, shopName, 2);
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

  // ── PENDING COMPACT VIEW (not yet expanded) ──
  if (order.status === "PENDING" && !expanded) {
    return (
      <div
        className={`bg-[#1a1a1a] rounded-xl border-t-4 ${ORDER_STATUS_BORDER["PENDING"]} border border-white/5 overflow-hidden`}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-[28px] leading-none text-white tracking-tight">
                {ticketNumber}
              </span>
              <span className="text-[20px] font-bold text-gray-300 leading-none truncate">
                {clientName}
              </span>
              {order.isPro && (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">
                  PRO
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500">
                {order.items.length} article{order.items.length > 1 ? "s" : ""}
              </span>
              <span className="text-base font-bold text-white">{formatPrice(order.totalCents)}</span>
              {pickupTime && (
                <span className="text-sm font-bold text-amber-400">
                  <Clock size={12} className="inline mr-0.5" />{pickupTime}
                </span>
              )}
              <span className="text-xs text-gray-600">{timeSince(order.createdAt)}</span>
            </div>
          </div>
          <button
            onClick={handleView}
            className="shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-6 py-3.5 rounded-xl transition-all text-base"
          >
            <Eye size={18} />
            VOIR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#1a1a1a] rounded-xl border-t-4 ${ORDER_STATUS_BORDER[order.status] || "border-t-gray-600"} border border-white/5 overflow-hidden ${readyOver30 ? "ring-2 ring-amber-500/50 animate-pulse" : ""} ${isLate ? "ring-2 ring-red-500/50" : ""}`}
    >
      {/* ── Late badge ── */}
      {isLate && (
        <div className="mx-4 mt-3 mb-1 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center justify-center gap-2">
          <Timer size={14} className="text-red-400" />
          <span className="text-sm font-bold text-red-400">
            EN RETARD de {lateMinutes} min
          </span>
        </div>
      )}

      {/* ── Header: #047 · Prénom ── */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-[32px] leading-none text-white tracking-tight">
              {ticketNumber}
            </span>
            <span className="text-[22px] font-bold text-gray-300 leading-none">
              {clientName}
            </span>
            {order.isPro && (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">
                PRO
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {pickupTime && (
              <span className="text-base font-bold text-amber-400">
                <Clock size={13} className="inline mr-0.5" /> Retrait {pickupTime}
              </span>
            )}
            {customerNum && (
              <span className="text-[13px] text-gray-500">Client {customerNum}</span>
            )}
            {order.user?.phone && (
              <a href={`tel:${order.user.phone}`} className="flex items-center gap-1 text-[13px] text-blue-400 hover:text-blue-300 transition-colors">
                <Phone size={11} /> {order.user.phone}
              </a>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <span className="text-sm text-gray-500">
            <Clock size={11} className="inline mr-1" />
            {formatTime(order.createdAt)}
          </span>
          {order.status === "PENDING" && (
            <span className="text-xs text-gray-600">
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
        <div className="mx-4 mb-2 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-center">
          <span className="text-xs font-bold text-amber-400">
            En attente depuis {waitMinutes} min
          </span>
        </div>
      )}

      {/* ── Items list ── */}
      <div className="px-4 pb-2">
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between text-base ${!item.available ? "opacity-40 line-through" : ""}`}
            >
              <span className="text-gray-300">
                <span className="text-white font-bold text-lg">
                  {item.quantity}
                </span>{" "}
                {formatUnit(item.product?.unit || item.unit)} — <span className="font-medium text-white">{item.product?.name || item.name}</span>
                {(item.product?.unit === "TRANCHE" || item.unit === "TRANCHE") && item.sliceCount && (
                  <span className="ml-1 text-amber-400 text-xs">
                    ({item.sliceCount} tr.{item.sliceThickness ? ` ${item.sliceThickness}` : ""})
                  </span>
                )}
                {(item.product?.unit === "KG" || item.unit === "KG") && item.weightGrams && (
                  <span className="ml-1 text-blue-400 text-xs">({item.weightGrams}g)</span>
                )}
              </span>
              <span className="text-gray-500 text-xs shrink-0 ml-2">
                {formatPrice(item.totalCents || item.priceCents * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Price adjustment badge ── */}
      {order.priceAdjustment?.status === "PENDING" && (
        <div className="mx-4 mb-2 px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded-lg">
          <p className="text-xs font-bold text-amber-400 text-center">
            Ajustement en attente de validation client
          </p>
          <p className="text-[11px] text-amber-400/70 text-center mt-0.5">
            {formatPrice(order.priceAdjustment.originalTotal)} → {formatPrice(order.priceAdjustment.newTotal)}
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "AUTO_APPROVED" && (
        <div className="mx-4 mb-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-[11px] text-emerald-400 text-center">
            Prix ajuste automatiquement ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "APPROVED" && (
        <div className="mx-4 mb-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-[11px] text-emerald-400 text-center">
            Ajustement accepte par le client ({formatPrice(order.priceAdjustment.newTotal)})
          </p>
        </div>
      )}

      {order.priceAdjustment?.status === "REJECTED" && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-[11px] text-red-400 text-center">
            Ajustement refuse par le client
          </p>
        </div>
      )}

      {/* ── Total ── */}
      <div className="px-4 pb-2 flex justify-between items-center">
        <span className="text-sm text-gray-500">Total</span>
        <span className="text-lg font-bold text-white">{formatPrice(order.totalCents)}</span>
      </div>

      {/* ── Customer note ── */}
      {order.customerNote && (
        <div className="px-4 pb-2">
          <div className="bg-blue-500/10 rounded-lg px-3 py-2 flex items-start gap-2">
            <MessageSquare size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-300">&quot;{order.customerNote}&quot;</p>
          </div>
        </div>
      )}

      {/* ── Requested time (only if not already shown in header pickup) ── */}
      {order.requestedTime && !pickupTime && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500">
            <Clock size={11} className="inline mr-1" />
            Retrait souhaité : {formatTime(order.requestedTime)}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── ACTIONS by status ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="px-4 pb-4 pt-1 space-y-2">

        {/* ── PENDING (expanded): Accept / Deny ── */}
        {order.status === "PENDING" && !showAcceptForm && !showDenyForm && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => printOrderTicket(order, shopName)}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Printer size={13} /> Ticket
              </button>
              <button
                onClick={() => setShowDenyForm(true)}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                <XCircle size={16} /> Refuser
              </button>
              <button
                onClick={() => { setShowAcceptForm(true); setAcceptMinutes(shopPrepTime); }}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                <CheckCircle size={16} /> Accepter
              </button>
            </div>
          </div>
        )}

        {/* ── Accept form (prep time selector) ── */}
        {order.status === "PENDING" && showAcceptForm && (
          <div className="bg-emerald-500/10 rounded-xl p-4 space-y-3 border border-emerald-500/20">
            <p className="text-sm font-medium text-emerald-300">
              Délai de préparation
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setAcceptMinutes(m)}
                  className={`px-3 min-h-[44px] py-2 rounded-lg text-sm font-bold transition-all ${
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
                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center"
                min={1}
                max={480}
              />
              <span className="text-sm text-gray-500">min</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => doAction("accept", { estimatedMinutes: acceptMinutes })}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all text-base disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                CONFIRMER LA COMMANDE
              </button>
              <button
                onClick={() => setShowAcceptForm(false)}
                className="px-4 py-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── Deny form ── */}
        {order.status === "PENDING" && showDenyForm && (
          <div className="bg-red-500/10 rounded-xl p-4 space-y-3 border border-red-500/20">
            <p className="text-sm font-medium text-red-300">Raison du refus</p>
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
              placeholder="Ou saisissez une raison personnalisee..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder-gray-600"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={() => doAction("deny", { reason: denyReason })}
                disabled={loading || !denyReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                Confirmer le refus
              </button>
              <button
                onClick={() => { setShowDenyForm(false); setDenyReason(""); }}
                className="px-4 py-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── ACCEPTED: Start preparing / Mark ready / Adjust price ── */}
        {order.status === "ACCEPTED" && (
          <div className="space-y-2">
            {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
              <button
                onClick={() => onAdjustPrice(order)}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                <DollarSign size={16} /> Ajuster le prix
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => doAction("start_preparing")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />}
                En préparation
              </button>
              <button
                onClick={() => doAction("mark_ready")}
                disabled={loading || order.priceAdjustment?.status === "PENDING"}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                <CheckCircle size={16} /> Prête !
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +10 min
              </button>
              <button
                onClick={() => printOrderTicket(order, shopName)}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Printer size={13} /> Ticket
              </button>
            </div>
          </div>
        )}

        {/* ── PREPARING: Mark ready / Add time / Adjust price ── */}
        {order.status === "PREPARING" && (
          <div className="space-y-2">
            {onAdjustPrice && order.priceAdjustment?.status !== "PENDING" && (
              <button
                onClick={() => onAdjustPrice(order)}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                <DollarSign size={16} /> Ajuster le prix
              </button>
            )}
            <button
              onClick={() => doAction("mark_ready")}
              disabled={loading || order.priceAdjustment?.status === "PENDING"}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all text-base disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              Commande prête !
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +10 min
              </button>
              <button
                onClick={() => printOrderTicket(order, shopName)}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Printer size={13} /> Ticket
              </button>
            </div>
          </div>
        )}

        {/* ── READY: Remis au client ── */}
        {order.status === "READY" && (
          <div className="space-y-2">
            <button
              onClick={() => {
                if (!order.qrCode) {
                  doAction("manual_pickup");
                  return;
                }
                doAction("confirm_pickup", { qrCode: order.qrCode });
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all text-base disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
              Remis au client
            </button>
            <button
              onClick={() => printOrderTicket(order, shopName)}
              className="w-full flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 min-h-[44px] py-2 rounded-xl text-xs font-medium transition-all"
            >
              <Printer size={13} /> Imprimer le ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
