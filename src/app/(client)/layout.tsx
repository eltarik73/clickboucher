"use client";

import { CartProvider } from "@/lib/hooks/use-cart";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
