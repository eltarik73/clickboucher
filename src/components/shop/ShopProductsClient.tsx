// src/components/shop/ShopProductsClient.tsx — V2 bis shop products page
"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/hooks/use-cart";
import { WeightSheet, type WeightSheetProduct } from "@/components/product/WeightSheet";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductCardData } from "@/components/product/ProductCard";
import { ProductSheet } from "@/components/product/ProductSheet";
import { resolveProductImage } from "@/lib/product-images";

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
  proPriceCents?: number | null;
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
  proStatus?: { isPro: boolean; status?: string; companyName?: string };
}

export function ShopProductsClient({ products, categories, shop, proStatus: _proStatus }: Props) {
  const [activeCat, setActiveCat] = useState<string>("Tout");
  const [selectedProduct, setSelectedProduct] = useState<WeightSheetProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<ProductCardData | null>(null);
  const { addItem, updateQty, itemCount, totalCents, state } = useCart();

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
          imageUrl: resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.category.name }),
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
          imageUrl: resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.category.name }),
          unit: p.unit as "PIECE" | "BARQUETTE",
          priceCents: p.priceCents,
          quantity: 1,
          category: p.category.name,
        },
        shopRef
      );
      toast.success(`${p.name} ajouté au panier`, { icon: <ShoppingBag size={14} />, duration: 1500 });
      navigator.vibrate?.(50);
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
      toast.success(`${selectedProduct.name} (${weightG}g) ajouté`, { icon: <ShoppingBag size={14} />, duration: 1500 });
      navigator.vibrate?.(50);
      setSelectedProduct(null);
    },
    [selectedProduct, addItem, shopRef]
  );

  // Cart items for this shop (for inline stepper)
  const cartItems = useMemo(
    () => state.shopId === shop.id
      ? state.items.map(i => ({ id: i.id, quantity: i.quantity }))
      : [],
    [state.shopId, state.items, shop.id]
  );

  const handleIncrement = useCallback(
    (productId: string) => {
      const item = state.items.find(i => i.id === productId);
      if (item) updateQty(productId, item.quantity + 1);
    },
    [state.items, updateQty]
  );

  const handleDecrement = useCallback(
    (productId: string) => {
      const item = state.items.find(i => i.id === productId);
      if (item) updateQty(productId, item.quantity - 1);
    },
    [state.items, updateQty]
  );

  return (
    <>
      {/* ── Sticky category pills ── */}
      <div className="sticky top-0 z-20 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/[0.06]">
        <div
          className="flex gap-2 overflow-x-auto px-4 py-2.5"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setActiveCat("Tout")}
            className={`shrink-0 px-3 py-1.5 rounded-[20px] text-[12px] font-semibold whitespace-nowrap transition-all ${
              activeCat === "Tout"
                ? "bg-[#DC2626] text-white border border-[#DC2626]"
                : "border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
            }`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-[20px] text-[12px] font-semibold whitespace-nowrap transition-all ${
                activeCat === c.id
                  ? "bg-[#DC2626] text-white border border-[#DC2626]"
                  : "border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
              }`}
            >
              {c.emoji ? `${c.emoji} ` : ""}{c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Promo section ── */}
      {activeCat === "Tout" && promoProducts.length > 0 && (
        <div className="px-3 pt-2 mb-1">
          <p className="text-[11px] font-bold text-[#DC2626] uppercase tracking-wider mb-1.5">
            Promos
          </p>
          <ProductGrid products={promoProducts} onAdd={handleAdd} onTap={setDetailProduct} cartItems={cartItems} onIncrement={handleIncrement} onDecrement={handleDecrement} />
        </div>
      )}

      {/* ── Product grid ── */}
      <ProductGrid products={nonPromoProducts} onAdd={handleAdd} onTap={setDetailProduct} cartItems={cartItems} onIncrement={handleIncrement} onDecrement={handleDecrement} />

      {/* ── Bottom cart bar — sticky, glassmorphism, slide-up entrance ── */}
      {cartCount > 0 && (
        <div
          className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200/50 dark:border-white/[0.08] animate-[slideUp_0.3s_ease-out]"
          style={{
            background: "rgba(20,20,20,0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "10px 16px",
          }}
        >
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            {/* Left: badge + "Panier" + total */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-[#DC2626] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {cartCount}
              </span>
              <span className="text-[13px] font-semibold text-white">Panier</span>
              <span className="text-[13px] font-bold text-[#DC2626]">{fmtPrice(totalCents)}</span>
            </div>

            {/* Right: "Commander →" button */}
            <Link
              href="/panier"
              className="flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Commander <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* ── WeightSheet ── */}
      <WeightSheet
        product={selectedProduct}
        onConfirm={handleWeightConfirm}
        onClose={() => setSelectedProduct(null)}
      />

      {/* ── Product detail bottom sheet ── */}
      <ProductSheet
        product={detailProduct}
        cartQty={detailProduct ? (cartItems.find(i => i.id === detailProduct.id)?.quantity ?? 0) : 0}
        onAdd={() => { if (detailProduct) handleAdd(detailProduct); }}
        onIncrement={detailProduct ? () => handleIncrement(detailProduct.id) : undefined}
        onDecrement={detailProduct ? () => handleDecrement(detailProduct.id) : undefined}
        onClose={() => setDetailProduct(null)}
      />
    </>
  );
}
