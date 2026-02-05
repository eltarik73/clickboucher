// src/components/product/FilterChips.tsx
"use client";

interface Props {
  categories: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function FilterChips({ categories, active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
      {categories.map(cat => (
        <button key={cat.id} type="button" onClick={() => onChange(cat.id)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap
            ${active === cat.id
              ? "bg-[#1A1A1A] text-white shadow-sm"
              : "bg-[#F5F3F0] text-[#6B6560] hover:bg-[#EBE8E4]"
            }`}>
          {cat.label}
        </button>
      ))}
    </div>
  );
}
