// src/components/landing/QuickCategories.tsx — Decorative category chips
"use client";

const CATEGORIES = [
  { label: "Boeuf", emoji: "🥩" },
  { label: "Poulet", emoji: "🍗" },
  { label: "Agneau", emoji: "🐑" },
  { label: "Merguez", emoji: "🌭" },
  { label: "Packs", emoji: "📦" },
  { label: "Promo", emoji: "🏷️" },
];

export function QuickCategories() {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2"
      style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      {CATEGORIES.map((c) => (
        <button
          key={c.label}
          onClick={() => document.getElementById("butchers")?.scrollIntoView({ behavior: "smooth" })}
          className="flex items-center gap-1.5 bg-white dark:bg-white/[0.03] border border-[#ece8e3] dark:border-white/[0.06] rounded-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap shrink-0 hover:border-[#DC2626] hover:text-[#DC2626] transition-all active:scale-95"
        >
          <span className="text-base">{c.emoji}</span>
          {c.label}
        </button>
      ))}
    </div>
  );
}
