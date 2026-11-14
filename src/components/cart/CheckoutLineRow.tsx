// src/components/cart/CheckoutLineRow.tsx — one line of the /panier page, with the server's
// refusal of that line (if any) printed under it and a button to remove it.
"use client";

import Image from "next/image";
import { AlertCircle, Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "@/lib/cart/cart-line";
import { formatGrams } from "@/lib/pricing/format";
import { formatPrice } from "@/lib/utils";

const THICKNESS_LABELS: Record<string, string> = {
  chiffonnade: "chiffonnade",
  fine: "fine",
  normale: "normale",
  epaisse: "épaisse",
};

function qtyLabel(item: CartItem) {
  if (item.unit === "TRANCHE" && item.sliceCount && item.thickness) {
    return `${item.sliceCount} tranches (${THICKNESS_LABELS[item.thickness] || item.thickness}) — ~${formatGrams(item.weightGrams)}`;
  }
  if (item.unit === "KG" || item.unit === "TRANCHE") {
    const weight = formatGrams(item.weightGrams);
    return item.quantity > 1 ? `${item.quantity} × ${weight}` : weight;
  }
  const u = item.unit === "PIECE" ? "pièce" : "barquette";
  return `${item.quantity} ${u}${item.quantity > 1 ? "s" : ""}`;
}

export function CheckoutLineRow({
  item,
  lineTotalCents,
  refusal,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem;
  lineTotalCents: number;
  /** Server messages refusing this line; none when the line is accepted. */
  refusal: readonly string[] | undefined;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const refused = refusal !== undefined && refusal.length > 0;
  return (
    <div
      className={`rounded-2xl border bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.03)] dark:bg-[#141414] ${
        refused ? "border-red-300 dark:border-red-800" : "border-[#ece8e3] dark:border-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl">
          <Image
            src={item.imageUrl || "/img/products/boeuf-1.jpg"}
            alt={item.name}
            width={60}
            height={60}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {item.name}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{qtyLabel(item)}</p>
          <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
            {formatPrice(lineTotalCents)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onUpdateQty(item.quantity - 1)}
            aria-label="Diminuer la quantité"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-500 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-gray-400 dark:hover:bg-white/5"
          >
            <Minus size={16} />
          </button>
          <span className="min-w-[20px] text-center text-sm font-bold text-gray-900 dark:text-white">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQty(item.quantity + 1)}
            aria-label="Augmenter la quantité"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#DC2626] text-white transition-colors hover:bg-[#b91c1c]"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          onClick={onRemove}
          aria-label="Supprimer du panier"
          className="shrink-0 rounded-xl p-3 text-gray-500 transition-colors hover:bg-red-50 hover:text-[#DC2626] dark:text-gray-400 dark:hover:bg-red-950/20"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {refused && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <ul className="space-y-0.5 text-xs">
              {refusal.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            <button
              onClick={onRemove}
              className="mt-2 min-h-[44px] rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-[#1a1a1a] dark:text-red-300 dark:hover:bg-red-950/50"
            >
              Retirer cet article
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
