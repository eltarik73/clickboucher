"use client";

import { CartProvider, useCartState } from "@/lib/hooks/useCart";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const cartState = useCartState();
  return <CartProvider value={cartState}>{children}</CartProvider>;
}
