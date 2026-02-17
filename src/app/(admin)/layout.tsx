"use client";

import { useState } from "react";
import {
  AdminSidebar,
  AdminMobileNav,
  AdminMobileHeader,
} from "@/components/layout/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Desktop sidebar */}
      <AdminSidebar />

      {/* Mobile header + hamburger overlay */}
      <AdminMobileHeader
        open={menuOpen}
        onToggle={() => setMenuOpen((v) => !v)}
      />

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="p-4 md:p-8 pb-20 md:pb-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <AdminMobileNav />
    </div>
  );
}
