"use client";

import { useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const TABS = [
  { key: "boutiques", label: "Boutiques", icon: "🏪", href: "/webmaster/boutiques" },
  { key: "demandes", label: "Demandes PRO", icon: "📩", href: "/webmaster/demandes" },
  { key: "stats", label: "Stats", icon: "📊", href: "/webmaster/stats" },
];

export default function WebmasterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = TABS.find((t) => pathname.startsWith(t.href))?.key || "boutiques";

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-r from-stone-950 to-stone-900 text-white px-5 py-3.5 flex items-center gap-3.5">
        <button
          onClick={() => router.push("/decouvrir")}
          className="w-10 h-10 rounded-[10px] grid place-items-center text-lg transition-all border border-white/20 bg-white/10 text-white hover:bg-white/20"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-bold truncate">Klik&amp;Go Admin</p>
          <p className="text-[11px] opacity-50">Panneau webmaster</p>
        </div>
        <Badge className="bg-white/10 text-stone-400 border-none text-[10px]">
          Webmaster
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 py-4 mx-auto max-w-[900px] overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => router.push(t.href)}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === t.key
                ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900"
                : "bg-transparent text-stone-500 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-white/10"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <main className="mx-auto max-w-[900px] px-5 pb-10">{children}</main>
    </div>
  );
}
