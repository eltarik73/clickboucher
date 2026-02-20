// KitchenOrderCard — Dark theme order card for kitchen mode
"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChefHat,
  Package,
  Timer,
  Printer,
  Loader2,
  MessageSquare,
  Clock,
} from "lucide-react";
import PrepTimer from "./PrepTimer";
import { printOrderTicket } from "./OrderTicket";
import type { KitchenOrder } from "@/hooks/use-order-polling";

type Props = {
  order: KitchenOrder;
  shopName?: string;
  shopPrepTime?: number;
  onAction: (orderId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  onStockIssue: (order: KitchenOrder) => void;
};

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function formatUnit(unit: string) {
  return unit === "KG" ? "kg" : unit === "PIECE" ? "pc" : "barq.";
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

// Status → top border color
const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-t-amber-400",
  ACCEPTED: "border-t-blue-400",
  PREPARING: "border-t-indigo-400",
  READY: "border-t-emerald-400",
};

export default function KitchenOrderCard({
  order,
  shopName,
  shopPrepTime = 15,
  onAction,
  onStockIssue,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [acceptMinutes, setAcceptMinutes] = useState(shopPrepTime);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState("");

  const clientName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : "Client";

  async function doAction(action: string, data?: Record<string, unknown>) {
    setLoading(true);
    try {
      await onAction(order.id, action, data);
      setShowAcceptForm(false);
      setShowDenyForm(false);
      setDenyReason("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`bg-[#1a1a1a] rounded-xl border-t-4 ${STATUS_COLORS[order.status] || "border-t-gray-600"} border border-white/5 overflow-hidden`}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-base text-white">
              #{order.orderNumber}
            </span>
            {order.isPro && (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">
                PRO
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{clientName}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <span className="text-lg font-bold text-white">
            {formatPrice(order.totalCents)}
          </span>
          {order.status === "PENDING" && (
            <span className="text-xs text-gray-500">
              <Clock size={11} className="inline mr-1" />
              {timeSince(order.createdAt)}
            </span>
          )}
          {(order.status === "ACCEPTED" || order.status === "PREPARING") && (
            <PrepTimer estimatedReady={order.estimatedReady} size="sm" />
          )}
          {order.status === "READY" && order.actualReady && (
            <span className="text-xs text-amber-400">
              Attente : {timeSince(order.actualReady)}
            </span>
          )}
        </div>
      </div>

      {/* ── Items list ── */}
      <div className="px-4 pb-2">
        <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between text-sm ${!item.available ? "opacity-40 line-through" : ""}`}
            >
              <span className="text-gray-300">
                <span className="text-white font-medium">
                  {item.quantity}
                </span>{" "}
                {formatUnit(item.product?.unit || item.unit)} — {item.product?.name || item.name}
              </span>
              <span className="text-gray-500 text-xs shrink-0 ml-2">
                {formatPrice(item.totalCents || item.priceCents * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Customer note ── */}
      {order.customerNote && (
        <div className="px-4 pb-2">
          <div className="bg-blue-500/10 rounded-lg px-3 py-2 flex items-start gap-2">
            <MessageSquare size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-300">{order.customerNote}</p>
          </div>
        </div>
      )}

      {/* ── Requested time ── */}
      {order.requestedTime && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500">
            <Clock size={11} className="inline mr-1" />
            Retrait souhaite : {formatTime(order.requestedTime)}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── ACTIONS by status ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="px-4 pb-4 pt-1 space-y-2">

        {/* ── PENDING: Accept / Deny / Stock issue ── */}
        {order.status === "PENDING" && !showAcceptForm && !showDenyForm && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { setShowAcceptForm(true); setAcceptMinutes(shopPrepTime); }}
              disabled={loading}
              className="col-span-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
            >
              <CheckCircle size={16} /> Accepter
            </button>
            <button
              onClick={() => setShowDenyForm(true)}
              disabled={loading}
              className="col-span-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
            >
              <XCircle size={16} /> Refuser
            </button>
            <button
              onClick={() => onStockIssue(order)}
              disabled={loading}
              className="col-span-1 flex items-center justify-center gap-1.5 bg-orange-600/20 hover:bg-orange-600/30 active:scale-95 text-orange-400 font-bold py-3 rounded-xl transition-all text-sm border border-orange-600/30 disabled:opacity-50"
            >
              <AlertTriangle size={16} /> Rupture
            </button>
          </div>
        )}

        {/* ── Accept form ── */}
        {order.status === "PENDING" && showAcceptForm && (
          <div className="bg-emerald-500/10 rounded-xl p-4 space-y-3 border border-emerald-500/20">
            <p className="text-sm font-medium text-emerald-300">
              Pret dans combien de minutes ?
            </p>
            <div className="flex items-center gap-2">
              {[10, 15, 20, 30, 45].map((m) => (
                <button
                  key={m}
                  onClick={() => setAcceptMinutes(m)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
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
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Confirmer
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
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Ex: Fermeture exceptionnelle, rupture totale..."
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

        {/* ── ACCEPTED: Start preparing / Mark ready ── */}
        {order.status === "ACCEPTED" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => doAction("start_preparing")}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />}
                En preparation
              </button>
              <button
                onClick={() => doAction("mark_ready")}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                <CheckCircle size={16} /> Prete !
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +10 min
              </button>
              <button
                onClick={() => printOrderTicket(order, shopName)}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Printer size={13} /> Ticket
              </button>
            </div>
          </div>
        )}

        {/* ── PREPARING: Mark ready / Add time ── */}
        {order.status === "PREPARING" && (
          <div className="space-y-2">
            <button
              onClick={() => doAction("mark_ready")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all text-base disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              Commande prete !
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => doAction("add_time", { addMinutes: 5 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +5 min
              </button>
              <button
                onClick={() => doAction("add_time", { addMinutes: 10 })}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Timer size={13} /> +10 min
              </button>
              <button
                onClick={() => printOrderTicket(order, shopName)}
                className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-xs font-medium transition-all"
              >
                <Printer size={13} /> Ticket
              </button>
            </div>
          </div>
        )}

        {/* ── READY: Confirm pickup ── */}
        {order.status === "READY" && (
          <div className="space-y-2">
            <button
              onClick={() => {
                if (!order.qrCode) {
                  // No QR code — do a manual pickup without QR validation
                  doAction("manual_pickup");
                  return;
                }
                doAction("confirm_pickup", { qrCode: order.qrCode });
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all text-base disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
              Recuperee par le client
            </button>
            <button
              onClick={() => printOrderTicket(order, shopName)}
              className="w-full flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-xs font-medium transition-all"
            >
              <Printer size={13} /> Imprimer le ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
