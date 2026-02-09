"use client";

import { BottomNav } from "@/components/layout/BottomNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
