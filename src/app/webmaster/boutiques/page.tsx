"use client";

import { useState } from "react";
import { SHOPS } from "@/lib/seed/data";
import { Card, Btn, Avatar, Badge } from "@/components/ui/shared";

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
        <Card
          key={s.id}
          className={`p-4 animate-fade-up ${!s.visible ? "opacity-40" : ""}`}
          style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
        >
          <div className="flex gap-3.5 items-center">
            <Avatar src={s.imageUrl} name={s.name} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{s.name}</p>
                {s.featured && (
                  <Badge variant="express" className="text-[10px]">
                    ⭐ Mise en avant
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {s.city} {s.halal ? "• Halal" : ""}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Btn
                size="sm"
                variant={s.featured ? "primary" : "secondary"}
                onClick={() => toggle(s.id, "featured")}
                className="text-xs"
              >
                {s.featured ? "★" : "☆"}
              </Btn>
              <Btn
                size="sm"
                variant={s.visible ? "success" : "danger"}
                onClick={() => toggle(s.id, "visible")}
                className="text-xs"
              >
                {s.visible ? "👁" : "🚫"}
              </Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
