// PriceAdjustModal — Boucher adjusts order price (weight/price/manual)
"use client";

import { useState } from "react";
import { DollarSign, Loader2, X, Scale, Tag, PenLine } from "lucide-react";
import type { KitchenOrder } from "@/hooks/use-order-polling";

type Props = {
  order: KitchenOrder;
  onClose: () => void;
  onConfirm: (orderId: string, data: AdjustData) => Promise<void>;
};

type AdjustData = {
  adjustmentType: "WEIGHT" | "PRICE" | "MANUAL";
  reason?: string;
  items?: { orderItemId: string; newQuantity?: number; newPriceCents?: number }[];
  newTotalCents?: number;
};

type TabKey = "WEIGHT" | "PRICE" | "MANUAL";

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default function PriceAdjustModal({ order, onClose, onConfirm }: Props) {
  const [tab, setTab] = useState<TabKey>("WEIGHT");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  // Weight tab: new quantities per item (keyed by item.id)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of order.items) {
      map[item.id] = item.quantity;
    }
    return map;
  });

  // Price tab: new unit prices per item (keyed by item.id, in cents)
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of order.items) {
      map[item.id] = item.priceCents;
    }
    return map;
  });

  // Manual tab: new total in cents
  const [manualTotal, setManualTotal] = useState(order.totalCents);

  // ── Calculate new total based on active tab ──
  const originalTotal = order.totalCents;
  let newTotal: number;

  if (tab === "WEIGHT") {
    newTotal = order.items.reduce((sum, item) => {
      const qty = quantities[item.id] ?? item.quantity;
      return sum + Math.round(item.priceCents * qty);
    }, 0);
  } else if (tab === "PRICE") {
    newTotal = order.items.reduce((sum, item) => {
      const price = prices[item.id] ?? item.priceCents;
      return sum + Math.round(price * item.quantity);
    }, 0);
  } else {
    newTotal = manualTotal;
  }

  const diff = newTotal - originalTotal;
  const diffPct = originalTotal > 0 ? (diff / originalTotal) * 100 : 0;
  const maxAllowed = Math.round(originalTotal * 1.1);
  const overMax = newTotal > maxAllowed;
  const hasChanges = newTotal !== originalTotal;

  async function handleSubmit() {
    setLoading(true);
    try {
      const data: AdjustData = {
        adjustmentType: tab,
        reason: reason || undefined,
      };

      if (tab === "WEIGHT") {
        data.items = order.items
          .filter((item) => (quantities[item.id] ?? item.quantity) !== item.quantity)
          .map((item) => ({
            orderItemId: item.id,
            newQuantity: quantities[item.id],
          }));
      } else if (tab === "PRICE") {
        data.items = order.items
          .filter((item) => (prices[item.id] ?? item.priceCents) !== item.priceCents)
          .map((item) => ({
            orderItemId: item.id,
            newPriceCents: prices[item.id],
          }));
      } else {
        data.newTotalCents = manualTotal;
      }

      await onConfirm(order.id, data);
      onClose();
    } catch {
      // handled by parent
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: TabKey; label: string; icon: typeof Scale }[] = [
    { key: "WEIGHT", label: "Grammage", icon: Scale },
    { key: "PRICE", label: "Prix", icon: Tag },
    { key: "MANUAL", label: "Manuel", icon: PenLine },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] rounded-2xl max-w-lg w-full shadow-2xl border border-white/10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign size={20} className="text-amber-400" />
            <h3 className="font-bold text-white text-base">Ajuster le prix</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Order info */}
        <div className="px-5 py-3 bg-white/5 shrink-0 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">Commande </span>
            <span className="text-sm font-mono font-bold text-white">
              {order.displayNumber || `#${order.orderNumber}`}
            </span>
          </div>
          <span className="text-sm font-bold text-white">{formatPrice(originalTotal)}</span>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-2 shrink-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {/* WEIGHT tab */}
          {tab === "WEIGHT" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Modifiez les quantites (poids reel) :</p>
              {order.items.map((item) => {
                const isKg = (item.product?.unit || item.unit) === "KG";
                return (
                  <div key={item.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {item.product?.name || item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} {isKg ? "kg" : "pc"} x {formatPrice(item.priceCents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        step={isKg ? "0.01" : "1"}
                        min={0}
                        value={quantities[item.id] ?? item.quantity}
                        onChange={(e) => setQuantities({ ...quantities, [item.id]: parseFloat(e.target.value) || 0 })}
                        className="w-20 bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      />
                      <span className="text-xs text-gray-500 w-6">{isKg ? "kg" : "pc"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PRICE tab */}
          {tab === "PRICE" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Modifiez les prix unitaires :</p>
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {item.product?.name || item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.quantity} — Actuel: {formatPrice(item.priceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={((prices[item.id] ?? item.priceCents) / 100).toFixed(2)}
                      onChange={(e) => setPrices({ ...prices, [item.id]: Math.round(parseFloat(e.target.value || "0") * 100) })}
                      className="w-24 bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    <span className="text-xs text-gray-500">EUR</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MANUAL tab */}
          {tab === "MANUAL" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Saisissez le nouveau total :</p>
              <div className="flex items-center gap-3 justify-center">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={(manualTotal / 100).toFixed(2)}
                  onChange={(e) => setManualTotal(Math.round(parseFloat(e.target.value || "0") * 100))}
                  className="w-40 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white text-xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <span className="text-lg text-gray-400 font-bold">EUR</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Raison (optionnel)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Poids reel different du commande..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder-gray-600"
              rows={2}
            />
          </div>
        </div>

        {/* ── Price diff display ── */}
        <div className="px-5 py-3 border-t border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">Ancien total</p>
              <p className="text-sm text-gray-400">{formatPrice(originalTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Difference</p>
              <p className={`text-sm font-bold ${diff < 0 ? "text-emerald-400" : diff > 0 ? "text-amber-400" : "text-gray-500"}`}>
                {diff >= 0 ? "+" : ""}{formatPrice(diff)} ({diffPct >= 0 ? "+" : ""}{diffPct.toFixed(1)}%)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Nouveau total</p>
              <p className="text-lg font-bold text-white">{formatPrice(newTotal)}</p>
            </div>
          </div>

          {/* Warnings */}
          {overMax && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-red-400 font-medium">
                L&apos;ajustement ne peut pas depasser +10% du prix initial ({formatPrice(maxAllowed)} max)
              </p>
            </div>
          )}

          {diff > 0 && !overMax && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-amber-400">
                Le client aura 5 min pour valider cette augmentation
              </p>
            </div>
          )}

          {diff < 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-emerald-400">
                Baisse de prix — sera appliquee automatiquement
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 font-medium transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasChanges || overMax || loading}
              className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <DollarSign size={16} />
                  Confirmer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
