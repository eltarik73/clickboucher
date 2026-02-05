"use client";

import { useRouter, usePathname } from "next/navigation";
import { BackBtn, Badge } from "@/components/ui/shared";
import { Card } from "@/components/ui/shared";
import { SEED_ORDERS } from "@/lib/seed/data";

const TABS = [
  { key: "boutiques", label: "🏪 Boutiques", href: "/webmaster/boutiques" },
  { key: "demandes", label: "📩 Demandes PRO", href: "/webmaster/demandes" },
  { key: "stats", label: "📊 Stats", href: "/webmaster/stats" },
];

const STATS = [
  { icon: "🏪", value: "3", label: "Boutiques" },
  { icon: "📦", value: String(SEED_ORDERS.length), label: "Commandes (j)" },
  {
    icon: "💰",
    value: `${SEED_ORDERS.reduce((s, o) => s + o.total, 0).toFixed(0)} €`,
    label: "CA estimé (j)",
  },
  { icon: "👤", value: "47", label: "Clients actifs" },
];

export default function WebmasterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = TABS.find((t) => pathname.startsWith(t.href))?.key || "boutiques";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Dark header */}
      <div className="sticky top-0 z-30 bg-gradient-to-r from-stone-950 to-stone-900 text-white px-5 py-3.5 flex items-center gap-3.5">
        <BackBtn onClick={() => router.push("/decouvrir")} light />
        <div className="flex-1">
          <p className="font-display text-base font-bold">ClickBoucher Admin</p>
          <p className="text-[11px] opacity-50">Panneau webmaster</p>
        </div>
        <Badge className="bg-white/10 text-stone-400 border-none text-[10px]">
          Admin
        </Badge>
      </div>

      {/* Stats */}
      <div className="mx-auto max-w-[900px] px-5 pt-5">
        <div className="grid grid-cols-4 gap-2.5">
          {STATS.map((s, i) => (
            <Card
              key={i}
              className="p-4 text-center animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` } as React.CSSProperties}
            >
              <p className="text-xl">{s.icon}</p>
              <p className="font-display text-xl font-extrabold mt-1.5">{s.value}</p>
              <p className="text-[11px] text-stone-500 mt-1">{s.label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 py-4 mx-auto max-w-[900px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => router.push(t.href)}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === t.key
                ? "bg-stone-900 text-white"
                : "bg-transparent text-stone-500 hover:bg-stone-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="mx-auto max-w-[900px] px-5 pb-10">{children}</main>
    </div>
  );
}
