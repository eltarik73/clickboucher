"use client";

import { useState } from "react";
import { PRODUCTS } from "@/lib/seed/data";
import { Card, Toggle } from "@/components/ui/shared";
import type { Product } from "@/types";

export default function BoucherCataloguePage() {
  const [products, setProducts] = useState<Product[]>(
    PRODUCTS.filter((p) => p.shopId === "cb_savoie_halal_1")
  );

  const toggleStock = (id: string) => {
    setProducts(
      products.map((p) => (p.id === id ? { ...p, stock: !p.stock } : p))
    );
  };

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-5">Mes produits</h2>
      <div className="flex flex-col gap-2">
        {products.map((p, i) => (
          <Card
            key={p.id}
            className="p-3.5 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` } as React.CSSProperties}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[13px] font-semibold">{p.name}</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {p.publicPrice.toFixed(2)} € • Pro: {p.proPrice.toFixed(2)} €
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-semibold ${
                    p.stock ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {p.stock ? "En stock" : "Épuisé"}
                </span>
                <Toggle on={p.stock} onToggle={() => toggleStock(p.id)} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
