"use client";

import { CartProvider, useCartState } from "@/lib/hooks/useCart";

export function CartProviderWrapper({ children }: { children: React.ReactNode }) {
  const cartState = useCartState();
  return <CartProvider value={cartState}>{children}</CartProvider>;
}
