"use client";

import { useUser } from "@clerk/nextjs";
// import { redirect } from "next/navigation";
import { BoucherNav } from "@/components/layout/BoucherNav";

export default function BoucherLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-[#8b2500] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // TODO: remettre la vérification de rôle après les tests
  // const role = user?.publicMetadata?.role as string | undefined;
  // if (!role || (role !== "boucher" && role !== "admin")) {
  //   redirect("/decouvrir");
  // }

  return (
    <div className="min-h-screen bg-gray-50">
      <BoucherNav />
      {/* Mobile: bottom padding for nav. Desktop: left padding for sidebar */}
      <main className="pb-20 md:pb-0 md:pl-[220px]">
        {children}
      </main>
    </div>
  );
}
