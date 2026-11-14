// src/components/cart/CartItem.tsx
"use client";

import { SafeImage } from "@/components/ui/SafeImage";
import type { CartItem as CartItemType } from "@/lib/hooks/use-cart";
import { cartLineTotalCents } from "@/lib/cart/cart-line";
import { formatGrams } from "@/lib/pricing/format";
import { formatPrice } from "@/lib/utils";

interface Props {
  item: CartItemType;
  onQuantityChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemCard({ item, onQuantityChange, onRemove }: Props) {
  const lineTotal = cartLineTotalCents(item);

  return (
    <div className="group flex gap-3 py-3">
      {/* Image */}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F5F3F0] dark:bg-white/10">
        {item.imageUrl ? (
          <SafeImage
            type="product"
            src={item.imageUrl}
            alt={item.name}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl opacity-30">
            🥩
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {item.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {item.weightGrams === undefined
                ? `${item.quantity} x ${formatPrice(item.priceCents)}`
                : `${item.quantity} x ${formatGrams(item.weightGrams)} · ${formatPrice(item.priceCents)}/kg`}
              {item.unit === "TRANCHE" && item.sliceCount && (
                <>
                  {" "}
                  — {item.sliceCount} tr.{item.thickness ? ` ${item.thickness}` : ""}
                </>
              )}
              {item.variant && (
                <span className="ml-1 rounded bg-[#DC2626]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
                  {item.variant}
                </span>
              )}
              {item.pieceCount && item.pieceLabel && (
                <span className="ml-1 text-[11px] text-gray-500 dark:text-gray-400">
                  ({item.pieceCount} {item.pieceLabel})
                </span>
              )}
              {item.cutOption && (
                <span className="ml-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-600">
                  {item.cutOption}
                </span>
              )}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
            {formatPrice(lineTotal)}
          </p>
        </div>

        {/* Quantity controls */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onQuantityChange(item.id, item.quantity - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
            >
              −
            </button>
            <span className="min-w-[32px] text-center text-sm font-medium text-gray-900 dark:text-white">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
            >
              +
            </button>
          </div>
          <button
            type="button"
            aria-label="Supprimer"
            onClick={() => onRemove(item.id)}
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-2 text-gray-500 opacity-100 transition-all hover:bg-red-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-red-950/30 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
