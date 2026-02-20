"use client";

import { useState } from "react";
import { SHOPS } from "@/lib/seed/data";
import { Avatar, Badge } from "@/components/ui/shared";

type ShopAdmin = (typeof SHOPS)[number] & { featured: boolean; visible: boolean };

export default function WebmasterBoutiquesPage() {
  const [shops, setShops] = useState<ShopAdmin[]>(
    SHOPS.map((s) => ({
      ...s,
      featured: s.id === "cb_savoie_halal_1",
      visible: true,
    }))
  );

  const toggle = (id: string, field: "featured" | "visible") => {
    setShops(shops.map((s) => (s.id === id ? { ...s, [field]: !s[field] } : s)));
  };

  return (
    <div className="flex flex-col gap-2.5">
      {shops.map((s, i) => (
        <div
          key={s.id}
          className={`bg-white dark:bg-[#141414] rounded-[20px] border border-stone-200 dark:border-white/10 shadow-sm p-4 animate-fade-up transition-all ${
            !s.visible ? "opacity-40" : ""
          }`}
          style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
        >
          <div className="flex gap-3.5 items-center">
            <Avatar src={s.imageUrl} name={s.name} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">
                  {s.name}
                </p>
                {s.featured && (
                  <Badge variant="express" className="text-[10px]">
                    Mise en avant
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-0.5">
                {s.city} {s.halal ? "- Halal" : ""}
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => toggle(s.id, "featured")}
                className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all flex items-center justify-center ${
                  s.featured
                    ? "bg-[#DC2626] text-white"
                    : "bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-gray-400 hover:bg-stone-200 dark:hover:bg-white/15"
                }`}
                title={s.featured ? "Retirer la mise en avant" : "Mettre en avant"}
              >
                {s.featured ? "\u2605" : "\u2606"}
              </button>
              <button
                onClick={() => toggle(s.id, "visible")}
                className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all flex items-center justify-center ${
                  s.visible
                    ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
                title={s.visible ? "Masquer la boutique" : "Rendre visible"}
              >
                {s.visible ? "\uD83D\uDC41" : "\uD83D\uDEAB"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
