"use client";

import Link from "next/link";
import { useCart } from "@/lib/hooks/useCart";

export function CartFAB() {
  const { itemCount, totalCents } = useCart();
  const count = itemCount;
  const total = totalCents / 100;

  if (count === 0) return null;

  return (
    <Link
      href="/panier"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-5 py-3 bg-[#DC2626] text-white rounded-full shadow-lg shadow-red-500/30 hover:bg-[#B91C1C] transition-all"
    >
      <div className="relative">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-[#DC2626] text-xs font-bold rounded-full flex items-center justify-center">
          {count}
        </span>
      </div>
      <span className="font-semibold">{total.toFixed(2)}€</span>
    </Link>
  );
}
