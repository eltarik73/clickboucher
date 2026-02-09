"use client";

import { CartProvider } from "@/lib/hooks/use-cart";
import { BottomNav } from "@/components/layout/BottomNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </CartProvider>
  );
}
