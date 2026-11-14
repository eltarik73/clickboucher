// src/components/client/AntiGaspiBanner.tsx — Anti-gaspi horizontal scroll banner for boutique page
"use client";

import { useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { resolveProductImage } from "@/lib/product-images";
import { useMountedNow } from "@/components/product/ProductCard";
import { displayedUnitPrice } from "@/lib/pricing/display";
import { limitedStockLowCount, limitedStockSoldOut } from "@/lib/pricing/limited-stock";
import { formatPrice } from "@/lib/utils";
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
  /** The product promotion applies on top of the anti-gaspi price, as at the quote. */
  promoPct: number | null;
  promoType: string | null;
  promoFixedCents: number | null;
  /** ISO date, or null without end date. */
  promoEnd: string | null;
  /** A product can be in both limited modes: the smaller counter is what remains. */
  isFlashSale?: boolean;
  flashSaleStock?: number | null;
  category: { name: string };
  images: { url: string }[];
}

/** The banner shows anti-gaspi products only: that limited mode is on, flash sale maybe too. */
function limitedStock(product: AntiGaspiProduct) {
  return {
    isAntiGaspi: true,
    antiGaspiStock: product.antiGaspiStock,
    isFlashSale: product.isFlashSale ?? false,
    flashSaleStock: product.flashSaleStock ?? null,
  };
}

export function AntiGaspiBanner({
  products: allProducts,
  shop,
}: {
  products: AntiGaspiProduct[];
  shop: QuickAddShop;
}) {
  const [selectedProduct, setSelectedProduct] = useState<QuickAddProduct | null>(null);
  const now = useMountedNow();
  const products = allProducts.filter((p) => !limitedStockSoldOut(limitedStock(p)));

  if (products.length === 0) return null;

  return (
    <div className="mx-4 mb-4">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 p-3.5 dark:border-emerald-800/30 dark:from-emerald-950/30 dark:to-emerald-900/20">
        {/* Audit a11y 2026-05-10 :
            - h3 -> h2 (heading-order : page commence par h1 puis h2)
            - text-emerald-600 (#059669) sur bg-emerald-100 (#D1FAE5) = ratio 3.2 FAIL AA
              -> text-emerald-700 (#047857) = ratio 4.6 PASS AA */}
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            🌿
          </span>
          <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Anti-Gaspi</h2>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            {products.length} produit{products.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {products.map((p) => {
            const imgSrc =
              p.images?.length > 0
                ? p.images[0].url
                : resolveProductImage({
                    name: p.name,
                    imageUrl: p.imageUrl,
                    category: p.category.name,
                  });
            const lowStock = limitedStockLowCount(limitedStock(p));
            const price = displayedUnitPrice(p, now);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setSelectedProduct({
                    id: p.id,
                    name: p.name,
                    imageUrl: imgSrc,
                    priceCents: p.priceCents,
                    unit: p.unit,
                    category: p.category.name,
                    ...limitedStock(p),
                    antiGaspiOrigPriceCents: p.antiGaspiOrigPriceCents,
                    promoPct: p.promoPct,
                    promoType: p.promoType,
                    promoFixedCents: p.promoFixedCents,
                    promoEnd: p.promoEnd,
                  })
                }
                className="w-[120px] flex-shrink-0 overflow-hidden rounded-xl border border-emerald-200/50 bg-white text-left transition-shadow hover:shadow-md active:scale-[0.97] dark:border-emerald-800/20 dark:bg-[#1a1a1a]"
              >
                <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-white/5">
                  <SafeImage
                    type="product"
                    src={imgSrc}
                    alt={p.name}
                    fill
                    sizes="120px"
                    className="object-cover"
                    quality={60}
                  />
                  {lowStock !== null && (
                    <div className="absolute bottom-1 left-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Plus que {lowStock}
                    </div>
                  )}
                </div>
                <div className="p-1.5">
                  <p className="truncate text-[10px] font-semibold text-gray-900 dark:text-white">
                    {p.name}
                  </p>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-[11px] font-bold text-emerald-600">
                      {formatPrice(price.unitPriceCents)}
                    </span>
                    {p.antiGaspiOrigPriceCents && (
                      <span className="text-[11px] text-gray-500 line-through dark:text-gray-400">
                        {formatPrice(p.antiGaspiOrigPriceCents)}
                      </span>
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
