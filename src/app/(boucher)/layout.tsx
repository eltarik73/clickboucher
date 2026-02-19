// Boucher layout — "use client" to avoid server DB call on every navigation.
// Role validation is already handled by middleware (with 5-min cache).
"use client";

import { BoucherNav } from "@/components/layout/BoucherNav";

export default function BoucherLayout({ children }: { children: React.ReactNode }) {
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
