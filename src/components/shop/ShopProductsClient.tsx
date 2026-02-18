// src/components/shop/ShopProductsClient.tsx — V2 shop products page
"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useCart } from "@/lib/hooks/use-cart";
import { WeightSheet, type WeightSheetProduct } from "@/components/product/WeightSheet";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductCardData } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { getProductImage } from "@/lib/product-images";

// ── Types ────────────────────────────────────────

export interface CategoryData {
  id: string;
  name: string;
  emoji: string | null;
}

export interface ProductData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  inStock: boolean;
  tags: string[];
  origin: string;
  halalOrg: string | null;
  race: string | null;
  freshness: string;
  popular: boolean;
  promoPct: number | null;
  promoEnd: string | null;
  promoType: string | null;
  customerNote: string | null;
  minWeightG: number;
  weightStepG: number;
  maxWeightG: number;
  category: CategoryData;
  images: { id: string; url: string; alt: string | null; order: number; isPrimary: boolean }[];
  labels: { id: string; name: string; color: string | null }[];
}

export interface ShopInfo {
  id: string;
  name: string;
  slug: string;
}

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

// ── Main Client Component ────────────────────────

interface Props {
  products: ProductData[];
  categories: CategoryData[];
  shop: ShopInfo;
}

export function ShopProductsClient({ products, categories, shop }: Props) {
  const [activeCat, setActiveCat] = useState<string>("Tout");
  const [selectedProduct, setSelectedProduct] = useState<WeightSheetProduct | null>(null);
  const { addItem, itemCount, totalCents, state } = useCart();

  const shopRef = useMemo(
    () => ({ id: shop.id, name: shop.name, slug: shop.slug }),
    [shop.id, shop.name, shop.slug]
  );
  const cartCount = state.shopId === shop.id ? itemCount : 0;

  const filtered = useMemo(() =>
    activeCat === "Tout"
      ? products
      : products.filter((p) => p.category.id === activeCat),
    [activeCat, products]
  );

  // Map ProductData to ProductCardData
  const cardProducts: ProductCardData[] = useMemo(
    () => filtered.map((p) => ({
      id: p.id,
      shopId: shop.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      priceCents: p.priceCents,
      unit: p.unit as "KG" | "PIECE" | "BARQUETTE",
      inStock: p.inStock,
      tags: p.tags,
      origin: p.origin,
      halalOrg: p.halalOrg,
      race: p.race,
      popular: p.popular,
      promoPct: p.promoPct,
      promoEnd: p.promoEnd,
      promoType: p.promoType,
      freshness: p.freshness,
      customerNote: p.customerNote,
      category: p.category,
      images: p.images,
      labels: p.labels,
    })),
    [filtered, shop.id]
  );

  // Separate promo products from non-promo
  const promoProducts = useMemo(
    () => cardProducts.filter((p) =>
      p.promoPct != null && p.promoPct > 0 && p.inStock &&
      (!p.promoEnd || new Date(p.promoEnd) > new Date())
    ),
    [cardProducts]
  );

  const nonPromoProducts = useMemo(
    () => activeCat === "Tout"
      ? cardProducts.filter((p) =>
          !(p.promoPct != null && p.promoPct > 0 && p.inStock &&
            (!p.promoEnd || new Date(p.promoEnd) > new Date()))
        )
      : cardProducts,
    [cardProducts, activeCat]
  );

  const handleAdd = useCallback(
    (p: ProductCardData) => {
      if (p.unit === "KG") {
        const original = products.find(prod => prod.id === p.id);
        setSelectedProduct({
          id: p.id,
          name: p.name,
          description: p.description || "",
          imageUrl: p.imageUrl || getProductImage(p.category.name),
          category: p.category.name,
          unit: p.unit,
          priceCents: p.priceCents,
          minWeightG: original?.minWeightG,
          weightStepG: original?.weightStepG,
          maxWeightG: original?.maxWeightG,
          origin: p.origin,
          halalOrg: p.halalOrg,
          race: p.race,
          freshness: p.freshness,
        });
        return;
      }
      addItem(
        {
          id: p.id,
          productId: p.id,
          name: p.name,
          imageUrl: p.imageUrl || getProductImage(p.category.name),
          unit: p.unit as "PIECE" | "BARQUETTE",
          priceCents: p.priceCents,
          quantity: 1,
          category: p.category.name,
        },
        shopRef
      );
    },
    [addItem, shopRef, products]
  );

  const handleWeightConfirm = useCallback(
    (weightG: number) => {
      if (!selectedProduct) return;
      addItem(
        {
          id: selectedProduct.id,
          productId: selectedProduct.id,
          name: selectedProduct.name,
          imageUrl: selectedProduct.imageUrl,
          unit: "KG",
          priceCents: selectedProduct.priceCents,
          quantity: 1,
          weightGrams: weightG,
          category: selectedProduct.category,
          quantiteG: weightG,
          prixAuKg: selectedProduct.priceCents / 100,
        },
        shopRef
      );
      setSelectedProduct(null);
    },
    [selectedProduct, addItem, shopRef]
  );

  return (
    <>
      {/* Sticky category pills — compact Uber style */}
      <div className="sticky top-0 z-20 bg-[#f8f6f3]/70 dark:bg-[#0a0a0a]/70 backdrop-blur-xl px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setActiveCat("Tout")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
              activeCat === "Tout"
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-white/80 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400"
            }`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                activeCat === c.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "bg-white/80 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400"
              }`}
            >
              {c.emoji ? `${c.emoji} ` : ""}{c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Promo section — compact */}
      {activeCat === "Tout" && promoProducts.length > 0 && (
        <div className="px-3 pt-1 mb-1">
          <p className="text-[11px] font-bold text-[#DC2626] uppercase tracking-wider mb-1.5">Promos</p>
          <ProductGrid products={promoProducts} onAdd={handleAdd} />
        </div>
      )}

      {/* Product grid */}
      <ProductGrid products={nonPromoProducts} onAdd={handleAdd} />

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-t border-[#ece8e3]/80 dark:border-white/[0.06] px-4 py-3 flex items-center justify-between shadow-lg z-50">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {cartCount} article{cartCount > 1 ? "s" : ""}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{fmtPrice(totalCents)}</span>
          </div>
          <Button variant="default" className="bg-[#DC2626] hover:bg-[#b91c1c]" asChild>
            <Link href="/panier">Commander</Link>
          </Button>
        </div>
      )}

      {/* WeightSheet */}
      <WeightSheet
        product={selectedProduct}
        onConfirm={handleWeightConfirm}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
}
