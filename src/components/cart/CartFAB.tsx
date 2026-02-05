// src/components/cart/CartFAB.tsx
"use client";

import { useCart } from "@/lib/hooks/useCart";
import { formatPrice } from "@/lib/estimate";

interface Props {
  onClick: () => void;
}

export function CartFAB({ onClick }: Props) {
  const { getItemCount, getTotal } = useCart();
  const count = getItemCount();
  const total = getTotal();

  if (count === 0) return null;

  return (
    <button type="button" onClick={onClick}
      className="fixed bottom-5 left-4 right-4 z-30 lg:hidden
        flex items-center justify-between px-5 py-3.5 rounded-2xl
        bg-[#7A1023] text-white shadow-xl shadow-[#7A1023]/30
        active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-2.5">
        <span className="text-base">🛒</span>
        <span className="text-[13px] font-semibold">Panier ({count})</span>
      </div>
      <span className="text-[14px] font-bold">{formatPrice(total)}</span>
    </button>
  );
}
