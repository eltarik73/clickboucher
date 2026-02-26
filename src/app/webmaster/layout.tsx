"use client";

import { WebmasterNav } from "@/components/layout/WebmasterNav";

export default function WebmasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <WebmasterNav />

      {/* Main content area — offset for desktop sidebar, padded for mobile bottom nav */}
      <main className="md:pl-[220px] pb-20 md:pb-0">
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-4 md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
