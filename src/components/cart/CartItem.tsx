// src/components/cart/CartItem.tsx
"use client";

import Image from "next/image";
import type { CartItem as CartItemType } from "@/lib/hooks/useCart";

interface Props {
  item: CartItemType;
  onQuantityChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemCard({ item, onQuantityChange, onRemove }: Props) {
  const price = item.priceCents / 100;
  const totalPrice = price * item.quantity;

  return (
    <div className="flex gap-3 py-3 group">
      {/* Image */}
      <div className="w-14 h-14 rounded-xl bg-[#F5F3F0] overflow-hidden shrink-0">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl opacity-30">🥩</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
            <p className="text-xs text-gray-500">
              {item.quantity} x {price.toFixed(2)}€
              {item.unit === "KG" && item.weightGrams && ` (${item.weightGrams}g)`}
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900 shrink-0">{totalPrice.toFixed(2)}€</p>
        </div>

        {/* Quantity controls */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <button 
              type="button" 
              onClick={() => onQuantityChange(item.id, item.quantity - 1)}
              className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              −
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[32px] text-center">{item.quantity}</span>
            <button 
              type="button" 
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              +
            </button>
          </div>
          <button
            type="button"
            aria-label="Supprimer"
            onClick={() => onRemove(item.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
