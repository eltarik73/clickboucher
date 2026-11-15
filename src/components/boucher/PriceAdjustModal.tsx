// PriceAdjustModal — the butcher weighs an order again, reprices its lines or types a new total.
// Before he sends it, the window shows the server's own plan (price-adjust-preview.ts): the value
// typed wrong, or whether the new price applies at once or the customer must accept it. The server
// plans again on send and applies the platform's cap; the parent shows its answer.
"use client";

import { useState, type KeyboardEvent } from "react";
import type { AdjustmentType } from "@prisma/client";
import { Euro, Loader2, PenLine, Scale, Tag, X } from "lucide-react";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { formatPriceCents as formatPrice, formatUnit } from "@/lib/format-kitchen";
import type { AdjustPriceRequest } from "@/lib/price-adjustment-request";
import type { AdjustmentPlan } from "@/lib/pricing/adjustment";
import { isWeighedUnit } from "@/lib/pricing/line";
import AdjustmentDecisionNotice from "./AdjustmentDecisionNotice";
import { formatItemQty, kitchenStoredLine } from "./OrderTicket";
import { previewAdjustment, type TypedInputs } from "./price-adjust-preview";

type Props = {
  order: KitchenOrder;
  onClose: () => void;
  /** Sends the adjustment; resolves true once the server took it (applied or sent to the customer). */
  onConfirm: (orderId: string, data: AdjustPriceRequest) => Promise<boolean>;
};

type Item = KitchenOrder["items"][number];
type Inputs = TypedInputs["weights"];

const TABS: ReadonlyArray<{ key: AdjustmentType; label: string; icon: typeof Scale }> = [
  { key: "WEIGHT", label: "Pesée", icon: Scale },
  { key: "PRICE", label: "Prix unitaire", icon: Tag },
  { key: "MANUAL", label: "Total", icon: PenLine },
];

const FIELD =
  "min-h-11 rounded-lg border border-white/10 bg-[#0a0a0a] px-2 text-center text-sm text-white " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white aria-[invalid=true]:border-red-500";

const isWeighed = (item: Item) => isWeighedUnit(kitchenStoredLine(item).unit);
const name = (item: Item) => item.product?.name || item.name;

function diffTone(diff: number): string {
  if (diff < 0) return "text-emerald-400";
  return diff > 0 ? "text-amber-400" : "text-gray-400";
}

/** Under the totals: the refusal of a value typed wrong, or what the server will do. */
function PlanNotice({ plan }: { plan: AdjustmentPlan | null }) {
  if (plan === null) return null;
  if (!plan.ok) return <p className="text-xs font-medium text-red-400">{plan.message}</p>;
  if (plan.unchanged) return null;
  return <AdjustmentDecisionNotice decision={plan.decision} />;
}

/** One line of the order with the field the butcher types its new weight, count or price in. */
function LineField(props: {
  item: Item;
  value: string;
  unit: string;
  label: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const { item } = props;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{name(item)}</p>
        <p className="text-xs text-gray-400">
          {formatItemQty(item)} · {formatPrice(item.priceCents)}{" "}
          {isWeighed(item) ? "le kg" : "l'unité"}
        </p>
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        aria-label={props.label}
        aria-invalid={props.invalid}
        className={`w-24 ${FIELD}`}
      />
      <span className="w-10 text-xs text-gray-400">{props.unit}</span>
    </div>
  );
}

export default function PriceAdjustModal({ order, onClose, onConfirm }: Props) {
  // A line out of stock is neither prepared nor charged: there is nothing to weigh or price.
  const items = order.items.filter((item) => item.available);
  const [tab, setTab] = useState<AdjustmentType>("WEIGHT");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [weights, setWeights] = useState<Inputs>(() =>
    Object.fromEntries(items.map((item) => [item.id, String(item.quantity)]))
  );
  const [prices, setPrices] = useState<Inputs>(() =>
    Object.fromEntries(items.map((item) => [item.id, (item.priceCents / 100).toFixed(2)]))
  );
  const [total, setTotal] = useState((order.totalCents / 100).toFixed(2));

  const preview = previewAdjustment(order, tab, { weights, prices, total });
  const plan = preview?.plan ?? null;
  // What the button sends: nothing while no field changes the order or one is refused.
  const request =
    preview !== null && preview.plan.ok && !preview.plan.unchanged ? preview.request : null;
  const newTotal = plan?.ok ? plan.newTotalCents : order.totalCents;
  const diff = newTotal - order.totalCents;
  const asks = plan?.ok === true && plan.decision.decision === "ASK";

  async function submit() {
    if (request === null) return;
    setLoading(true);
    try {
      const sent = await onConfirm(order.id, { ...request, reason: reason.trim() || undefined });
      if (sent) onClose();
    } finally {
      setLoading(false);
    }
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") onClose();
  }

  const invalidItem = plan?.ok === false ? plan.orderItemId : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-adjust-title"
      onKeyDown={closeOnEscape}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 py-2 pl-5 pr-2">
          <div className="flex items-center gap-2">
            <Euro size={20} className="text-amber-400" aria-hidden="true" />
            <h3 id="price-adjust-title" className="text-base font-bold text-white">
              Ajuster le prix · {order.displayNumber || `#${order.orderNumber}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Fermer la fenêtre d'ajustement"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 gap-2 px-5 pt-3">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-white/5 text-sm font-semibold text-gray-400 transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white aria-pressed:border-amber-500/30 aria-pressed:bg-amber-500/20 aria-pressed:text-amber-400"
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-3">
          {tab === "WEIGHT" && (
            <>
              <p className="text-xs text-gray-400">Poids réel (kg) ou nombre de pièces :</p>
              {items.map((item) => (
                <LineField
                  key={item.id}
                  item={item}
                  value={weights[item.id]}
                  unit={isWeighed(item) ? "kg" : formatUnit(item.unit)}
                  label={`Quantité pesée pour ${name(item)}`}
                  invalid={invalidItem === item.id}
                  onChange={(value) => setWeights({ ...weights, [item.id]: value })}
                />
              ))}
              <p className="text-xs font-medium text-amber-300">
                Remettez au client le ticket de pesée (poids et prix).
              </p>
            </>
          )}

          {tab === "PRICE" && (
            <>
              <p className="text-xs text-gray-400">Nouveau prix unitaire :</p>
              {items.map((item) => (
                <LineField
                  key={item.id}
                  item={item}
                  value={prices[item.id]}
                  unit={isWeighed(item) ? "€/kg" : "€"}
                  label={`Prix unitaire pour ${name(item)}`}
                  invalid={invalidItem === item.id}
                  onChange={(value) => setPrices({ ...prices, [item.id]: value })}
                />
              ))}
            </>
          )}

          {tab === "MANUAL" && (
            <div className="flex items-center justify-center gap-3 py-2">
              <input
                type="text"
                inputMode="decimal"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                aria-label="Nouveau total de la commande"
                aria-invalid={plan?.ok === false}
                className={`w-40 text-xl font-bold ${FIELD}`}
              />
              <span className="text-lg font-bold text-gray-400">€</span>
            </div>
          )}

          <label htmlFor="price-adjust-reason" className="block pt-1 text-xs text-gray-400">
            Motif (facultatif, le client le lit)
          </label>
          <textarea
            id="price-adjust-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Ex. : poids réel différent de la commande"
            className="w-full resize-none rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            rows={2}
          />
        </div>

        <div className="shrink-0 space-y-3 border-t border-white/10 px-5 py-3">
          <dl className="flex items-center justify-between">
            <div>
              <dt className="text-xs text-gray-400">Total actuel</dt>
              <dd className="text-sm text-gray-300">{formatPrice(order.totalCents)}</dd>
            </div>
            <div className="text-center">
              <dt className="text-xs text-gray-400">Écart de cet ajustement</dt>
              <dd className={`text-sm font-bold ${diffTone(diff)}`}>
                {diff > 0 ? "+" : ""}
                {formatPrice(diff)}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs text-gray-400">Nouveau total</dt>
              <dd className="text-lg font-bold text-white">{formatPrice(newTotal)}</dd>
            </div>
          </dl>

          <div aria-live="polite">
            <PlanNotice plan={plan} />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 flex-1 rounded-xl border border-white/10 font-medium text-gray-300 transition-all hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={request === null || loading}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-2 font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40 ${
                asks
                  ? "bg-amber-500 text-amber-950 hover:bg-amber-400"
                  : "bg-emerald-700 text-white hover:bg-emerald-600"
              }`}
            >
              {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {asks ? "Demander l'accord du client" : "Appliquer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
