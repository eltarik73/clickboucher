// PriceAdjustModal — Boucher adjusts order price (3-tier system)
"use client";

import { useState } from "react";
import {
  DollarSign,
  Loader2,
  X,
  Scale,
  Tag,
  PenLine,
  Shield,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { TIER_1_MAX, TIER_2_MAX, MAX_INCREASE_PCT } from "@/lib/price-adjustment-config";

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

function computeDisplayTier(diffPct: number, isDecrease: boolean): number {
  if (isDecrease) return 1;
  if (diffPct <= TIER_1_MAX) return 1;
  if (diffPct <= TIER_2_MAX) return 2;
  return 3;
}

export default function PriceAdjustModal({ order, onClose, onConfirm }: Props) {
  const [tab, setTab] = useState<TabKey>("WEIGHT");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  // Weight tab: new quantities per item
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of order.items) {
      map[item.id] = item.quantity;
    }
    return map;
  });

  const [weightInputs, setWeightInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of order.items) {
      const isKg = (item.product?.unit || item.unit) === "KG";
      map[item.id] = isKg ? item.quantity.toFixed(2) : String(item.quantity);
    }
    return map;
  });

  // Price tab: new unit prices per item
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of order.items) {
      map[item.id] = item.priceCents;
    }
    return map;
  });

  const [priceInputs, setPriceInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of order.items) {
      map[item.id] = (item.priceCents / 100).toFixed(2);
    }
    return map;
  });

  // Manual tab
  const [manualTotal, setManualTotal] = useState(order.totalCents);
  const [manualInput, setManualInput] = useState((order.totalCents / 100).toFixed(2));

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
  const diffPct = originalTotal > 0 ? Math.abs(diff / originalTotal) * 100 : 0;
  const maxAllowed = Math.round(originalTotal * (1 + MAX_INCREASE_PCT / 100));
  const overMax = newTotal > maxAllowed;
  const hasChanges = newTotal !== originalTotal;
  const isDecrease = diff < 0;
  const tier = hasChanges ? computeDisplayTier(diffPct, isDecrease) : 0;

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

  // ── Tier badge config ──
  const tierConfig = {
    1: { label: "Palier 1", color: "emerald", icon: Shield, desc: "Auto-accepte" },
    2: { label: "Palier 2", color: "amber", icon: Clock, desc: "30s pour refuser" },
    3: { label: "Palier 3", color: "red", icon: AlertTriangle, desc: "Approbation client requise" },
  } as const;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-adjust-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <DollarSign size={20} className="text-amber-400" aria-hidden="true" />
            <h3 id="price-adjust-title" className="text-base font-bold text-white">
              Ajuster le prix
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 transition-colors hover:text-white"
            aria-label="Fermer la fenêtre d'ajustement"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Order info */}
        <div className="flex shrink-0 items-center justify-between bg-white/5 px-5 py-3">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Commande </span>
            <span className="font-mono text-sm font-bold text-white">
              {order.displayNumber || `#${order.orderNumber}`}
            </span>
          </div>
          <span className="text-sm font-bold text-white">{formatPrice(originalTotal)}</span>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-2 px-5 pt-3">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                    : "border border-transparent bg-white/5 text-gray-500 hover:bg-white/10"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
          {/* WEIGHT tab */}
          {tab === "WEIGHT" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Modifiez les quantites (poids reel) :
              </p>
              {order.items.map((item) => {
                const isKg = (item.product?.unit || item.unit) === "KG";
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {item.product?.name || item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} {isKg ? "kg" : "pc"} x {formatPrice(item.priceCents)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        type="number"
                        step={isKg ? "0.01" : "1"}
                        min={0}
                        value={
                          weightInputs[item.id] ??
                          (isKg ? item.quantity.toFixed(2) : String(item.quantity))
                        }
                        onChange={(e) => {
                          setWeightInputs({ ...weightInputs, [item.id]: e.target.value });
                          setQuantities({
                            ...quantities,
                            [item.id]: parseFloat(e.target.value) || 0,
                          });
                        }}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setWeightInputs({
                            ...weightInputs,
                            [item.id]: isKg ? val.toFixed(2) : String(val),
                          });
                          setQuantities({ ...quantities, [item.id]: val });
                        }}
                        className="w-20 rounded-lg border border-white/10 bg-[#0a0a0a] px-2 py-2 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        aria-label={`Quantité pour ${item.product?.name || item.name}`}
                      />
                      <span className="w-6 text-xs text-gray-500">{isKg ? "kg" : "pc"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PRICE tab */}
          {tab === "PRICE" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Modifiez les prix unitaires :
              </p>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {item.product?.name || item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.quantity} — Actuel: {formatPrice(item.priceCents)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={priceInputs[item.id] ?? (item.priceCents / 100).toFixed(2)}
                      onChange={(e) => {
                        setPriceInputs({ ...priceInputs, [item.id]: e.target.value });
                        setPrices({
                          ...prices,
                          [item.id]: Math.round(parseFloat(e.target.value || "0") * 100),
                        });
                      }}
                      onBlur={(e) => {
                        const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                        setPriceInputs({ ...priceInputs, [item.id]: (cents / 100).toFixed(2) });
                        setPrices({ ...prices, [item.id]: cents });
                      }}
                      className="w-24 rounded-lg border border-white/10 bg-[#0a0a0a] px-2 py-2 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      aria-label={`Prix unitaire pour ${item.product?.name || item.name}`}
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
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Saisissez le nouveau total :
              </p>
              <div className="flex items-center justify-center gap-3">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    setManualTotal(Math.round(parseFloat(e.target.value || "0") * 100));
                  }}
                  onBlur={() => {
                    const cents = Math.round(parseFloat(manualInput || "0") * 100);
                    setManualInput((cents / 100).toFixed(2));
                    setManualTotal(cents);
                  }}
                  className="w-40 rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-center text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  aria-label="Nouveau montant total"
                />
                <span className="text-lg font-bold text-gray-500 dark:text-gray-400">EUR</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
              Raison {tier === 3 ? "(recommande)" : "(optionnel)"}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Poids reel different de la commande..."
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              rows={2}
            />
          </div>
        </div>

        {/* ── Price diff + tier display ── */}
        <div className="shrink-0 border-t border-white/10 px-5 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Ancien total</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatPrice(originalTotal)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Difference</p>
              <p
                className={`text-sm font-bold ${diff < 0 ? "text-emerald-400" : diff > 0 ? "text-amber-400" : "text-gray-500"}`}
              >
                {diff >= 0 ? "+" : ""}
                {formatPrice(diff)} ({diff >= 0 ? "+" : "-"}
                {diffPct.toFixed(1)}%)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Nouveau total</p>
              <p className="text-lg font-bold text-white">{formatPrice(newTotal)}</p>
            </div>
          </div>

          {/* Tier badge */}
          {hasChanges && !overMax && tier > 0 && (
            <div
              className={`mb-3 rounded-lg border px-3 py-2.5 ${
                tier === 1
                  ? "border-emerald-500/20 bg-emerald-500/10"
                  : tier === 2
                    ? "border-amber-500/20 bg-amber-500/10"
                    : "border-red-500/20 bg-red-500/10"
              }`}
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const tc = tierConfig[tier as 1 | 2 | 3];
                  const Icon = tc.icon;
                  return (
                    <>
                      <Icon
                        size={14}
                        className={
                          tier === 1
                            ? "text-emerald-400"
                            : tier === 2
                              ? "text-amber-400"
                              : "text-red-400"
                        }
                      />
                      <span
                        className={`text-xs font-bold ${
                          tier === 1
                            ? "text-emerald-400"
                            : tier === 2
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {tc.label}
                      </span>
                      <span
                        className={`ml-1 text-xs ${
                          tier === 1
                            ? "text-emerald-400/70"
                            : tier === 2
                              ? "text-amber-400/70"
                              : "text-red-400/70"
                        }`}
                      >
                        — {tc.desc}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p
                className={`mt-1 text-[11px] ${
                  tier === 1
                    ? "text-emerald-400/60"
                    : tier === 2
                      ? "text-amber-400/60"
                      : "text-red-400/60"
                }`}
              >
                {tier === 1 && isDecrease && "Baisse de prix — appliquee automatiquement"}
                {tier === 1 && !isDecrease && `Hausse ≤${TIER_1_MAX}% — appliquee automatiquement`}
                {tier === 2 && `Hausse ${TIER_1_MAX}-${TIER_2_MAX}% — le client a 30s pour refuser`}
                {tier === 3 &&
                  `Hausse >${TIER_2_MAX}% — le client doit accepter (escalade apres 10 min)`}
              </p>
            </div>
          )}

          {/* Over max warning */}
          {overMax && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <p className="text-xs font-medium text-red-400">
                L&apos;ajustement ne peut pas depasser +{MAX_INCREASE_PCT}% du prix initial (
                {formatPrice(maxAllowed)} max)
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-3 font-medium text-gray-500 transition-all hover:bg-white/5 hover:text-white dark:text-gray-400"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasChanges || overMax || loading}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                tier === 3
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              }`}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <DollarSign size={16} />
                  {tier === 3 ? "Envoyer au client" : "Confirmer"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
