// src/components/product/FilterChips.tsx — Category filter pills with emojis
"use client";

interface CategoryChip {
  id: string;
  label: string;
  emoji?: string | null;
}

interface Props {
  categories: CategoryChip[];
  active: string;
  onChange: (id: string) => void;
}

export function FilterChips({ categories, active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {categories.map(cat => (
        <button key={cat.id} type="button" onClick={() => onChange(cat.id)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap min-h-[36px]
            ${active === cat.id
              ? "bg-[#2A2018] dark:bg-white text-white dark:text-[#0a0a0a] shadow-sm"
              : "bg-[#F5F3F0] dark:bg-white/10 text-[#6B6560] dark:text-gray-400 hover:bg-[#EBE8E4] dark:hover:bg-white/15"
            }`}>
          {cat.emoji ? `${cat.emoji} ` : ""}{cat.label}
        </button>
      ))}
    </div>
  );
}
