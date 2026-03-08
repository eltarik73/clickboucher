// src/components/client/BonsPlansNav.tsx — Tab navigation for bons-plans sub-pages
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "all", label: "Tout", href: "/bons-plans" },
  { key: "anti-gaspi", label: "Anti-Gaspi", href: "/bons-plans/anti-gaspi", emoji: "\uD83C\uDF3F" },
  { key: "promos", label: "Promos", href: "/bons-plans/promos", emoji: "\uD83C\uDFF7\uFE0F" },
  { key: "flash", label: "Flash", href: "/bons-plans/vente-flash", emoji: "\u26A1" },
  { key: "packs", label: "Packs", href: "/bons-plans/packs", emoji: "\uD83D\uDCE6" },
  { key: "ramadan", label: "Ramadan", href: "/bons-plans/ramadan", emoji: "\uD83C\uDF19" },
];

export function BonsPlansNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || (tab.href !== "/bons-plans" && pathname.startsWith(tab.href));
        const isAllActive = tab.href === "/bons-plans" && pathname === "/bons-plans";

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
              isActive || isAllActive
                ? "bg-[#DC2626] text-white"
                : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15"
            }`}
          >
            {tab.emoji && <span className="mr-1">{tab.emoji}</span>}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
