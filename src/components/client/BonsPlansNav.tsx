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
    <div
      className="sticky top-0 z-20 flex gap-1.5 overflow-x-auto bg-[#f8f6f3] px-4 py-3 dark:bg-[#0a0a0a]"
      style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
    >
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.href || (tab.href !== "/bons-plans" && pathname.startsWith(tab.href));
        const isAllActive = tab.href === "/bons-plans" && pathname === "/bons-plans";

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive || isAllActive
                ? "bg-[#DC2626] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15"
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
