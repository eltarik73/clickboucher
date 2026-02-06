"use client";

import { CartProvider } from "@/lib/hooks/use-cart";

export function CartProviderWrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
