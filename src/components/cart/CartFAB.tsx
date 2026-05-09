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
      // Audit mobile 2026-05-09 : safe-area-inset-bottom pour iPhone X+
      // (sinon FAB peut être masqué par la barre Home indicator).
      style={{
        bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
      }}
      className="fixed right-4 z-40 flex items-center gap-3 rounded-full bg-primary px-5 py-3 text-white shadow-lg shadow-red-500/30 transition-all hover:bg-primary md:bottom-6 md:right-6"
      aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}, ${total.toFixed(2)}€`}
    >
      <div className="relative">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-primary dark:bg-gray-900">
          {count}
        </span>
      </div>
      <span className="font-semibold">{total.toFixed(2)}€</span>
    </Link>
  );
}
