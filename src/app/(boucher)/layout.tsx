// Boucher layout — "use client" to avoid server DB call on every navigation.
// Role validation is already handled by middleware (with 5-min cache).
// Kitchen mode (/boucher/commandes) renders full-screen without nav.
"use client";

import { usePathname } from "next/navigation";
import { BoucherNav } from "@/components/layout/BoucherNav";

export default function BoucherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isKitchenMode = pathname === "/boucher/commandes";

  // Kitchen mode: full-screen dark, no nav
  if (isKitchenMode) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        {children}
      </div>
    );
  }

  // Dashboard mode: with sidebar nav
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BoucherNav />
      {/* Mobile: bottom padding for nav. Desktop: left padding for sidebar */}
      <main className="pb-20 md:pb-0 md:pl-[220px]">
        {children}
      </main>
    </div>
  );
}
