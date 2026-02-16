"use client";

import { useState } from "react";
// import { useUser } from "@clerk/nextjs";
// import { useRouter } from "next/navigation";
// import { useEffect } from "react";
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

  // ── Role check (commented out for testing) ────
  // const { user, isLoaded } = useUser();
  // const router = useRouter();
  //
  // useEffect(() => {
  //   if (isLoaded && user?.publicMetadata?.role !== "admin") {
  //     router.replace("/decouvrir");
  //   }
  // }, [isLoaded, user, router]);
  //
  // if (!isLoaded) {
  //   return (
  //     <div className="flex items-center justify-center h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
  //       <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
  //     </div>
  //   );
  // }
  //
  // if (user?.publicMetadata?.role !== "admin") return null;

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
