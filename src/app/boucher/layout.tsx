"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { BackBtn, StatusDot } from "@/components/ui/shared";

const TABS = [
  { key: "commandes", label: "📋 Commandes", href: "/boucher/commandes" },
  { key: "catalogue", label: "🥩 Catalogue", href: "/boucher/catalogue" },
  { key: "parametres", label: "⚙️ Réglages", href: "/boucher/parametres" },
];

export default function BoucherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [serviceOn] = useState(true);

  const activeTab = TABS.find((t) => pathname.startsWith(t.href))?.key || "commandes";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header burgundy */}
      <div className="sticky top-0 z-30 bg-[#7A1023] text-white px-5 py-3.5 flex items-center gap-3.5">
        <BackBtn onClick={() => router.push("/decouvrir")} light />
        <div className="flex-1">
          <p className="font-display text-base font-bold">Boucherie Halal Saint-Léger</p>
          <p className="text-[11px] opacity-60">Espace boucher</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot color={serviceOn ? "#4ADE80" : "#F87171"} />
          <span className="text-[11px] font-semibold">
            {serviceOn ? "En service" : "Hors ligne"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 py-3 bg-white border-b border-stone-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => router.push(t.href)}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === t.key
                ? "bg-[#7A1023] text-white"
                : "bg-transparent text-stone-500 hover:bg-stone-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="mx-auto max-w-[800px] px-5 py-6">{children}</main>
    </div>
  );
}
