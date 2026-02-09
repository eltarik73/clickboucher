"use client";

import Link from "next/link";
import { useCart } from "@/lib/hooks/use-cart";

export function CartBadge() {
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <Link
      href="/panier"
      className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {itemCount}
      </span>
    </Link>
  );
}
