// src/components/client/AntiGaspiBanner.tsx — Anti-gaspi horizontal scroll banner for boutique page
"use client";

import { useState } from "react";
import Image from "next/image";
import { resolveProductImage } from "@/lib/product-images";
import { ProductQuickAdd, type QuickAddProduct, type QuickAddShop } from "./ProductQuickAdd";

interface AntiGaspiProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  antiGaspiOrigPriceCents: number | null;
  antiGaspiStock: number | null;
  antiGaspiReason: string | null;
  category: { name: string };
  images: { url: string }[];
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export function AntiGaspiBanner({ products, shop }: { products: AntiGaspiProduct[]; shop: QuickAddShop }) {
  const [selectedProduct, setSelectedProduct] = useState<QuickAddProduct | null>(null);

  if (products.length === 0) return null;

  return (
    <div className="mx-4 mb-4">
      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-2xl p-3.5 border border-emerald-200 dark:border-emerald-800/30">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-base">🌿</span>
          <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Anti-Gaspi</h3>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full font-semibold">
            {products.length} produit{products.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {products.map((p) => {
            const imgSrc = p.images?.length > 0
              ? p.images[0].url
              : resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.category.name });

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProduct({
                  id: p.id,
                  name: p.name,
                  imageUrl: imgSrc,
                  priceCents: p.priceCents,
                  unit: p.unit,
                  category: p.category.name,
                  isAntiGaspi: true,
                  antiGaspiOrigPriceCents: p.antiGaspiOrigPriceCents,
                  antiGaspiStock: p.antiGaspiStock,
                })}
                className="flex-shrink-0 w-[120px] bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden border border-emerald-200/50 dark:border-emerald-800/20 text-left hover:shadow-md transition-shadow active:scale-[0.97]"
              >
                <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-white/5">
                  <Image
                    src={imgSrc}
                    alt={p.name}
                    fill
                    sizes="120px"
                    className="object-cover"
                    quality={60}
                  />
                  {p.antiGaspiStock !== null && p.antiGaspiStock <= 5 && (
                    <div className="absolute bottom-1 left-1 text-[8px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded">
                      Plus que {p.antiGaspiStock}
                    </div>
                  )}
                </div>
                <div className="p-1.5">
                  <p className="text-[10px] font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-[11px] font-bold text-emerald-600">{fmtPrice(p.priceCents)}</span>
                    {p.antiGaspiOrigPriceCents && (
                      <span className="text-[9px] text-gray-400 line-through">{fmtPrice(p.antiGaspiOrigPriceCents)}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Purchase modal */}
      {selectedProduct && (
        <ProductQuickAdd
          product={selectedProduct}
          shop={shop}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
