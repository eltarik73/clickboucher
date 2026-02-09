"use client";

import { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/hooks/use-cart";
import { WeightSheet, type WeightSheetProduct } from "@/components/product/WeightSheet";
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
  tags: string[];
  promoPct: number | null;
  category: CategoryData;
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

function unitLabel(unit: string) {
  return unit === "KG" ? "/kg" : unit === "PIECE" ? "/pièce" : "/barq.";
}

// ── Product Card ─────────────────────────────────

function ProductCard({ product, productIndex, onAdd }: { product: ProductData; productIndex: number; onAdd: () => void }) {
  const imgSrc = product.imageUrl || getProductImage(product.category.name, productIndex);

  return (
    <div className="group relative flex gap-3 bg-white border border-[#ece8e3] rounded-[18px] p-2.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-[#ddd5cc] active:scale-[0.97] min-w-0 overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
      {/* Promo badge */}
      {product.promoPct != null && product.promoPct > 0 && (
        <span className="absolute -top-px -left-px bg-[#DC2626] text-white text-[7px] font-extrabold px-2 py-0.5 rounded-[18px_0_10px_0] tracking-wide z-10">
          -{product.promoPct}%
        </span>
      )}

      {/* Image */}
      <div className="w-[68px] h-[68px] rounded-[13px] overflow-hidden shrink-0">
        <Image
          src={imgSrc}
          alt={product.name}
          width={68}
          height={68}
          sizes="68px"
          className="rounded-[13px] object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[9px] font-bold text-[#DC2626] uppercase tracking-wider mb-0.5">
          {product.category.emoji ? `${product.category.emoji} ` : ""}
          {product.category.name}
        </span>
        <h3 className="text-[15px] font-bold text-[#2a2018] leading-tight truncate">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-[10.5px] text-[#7a7068] mt-0.5 truncate">
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          {product.promoPct != null && product.promoPct > 0 ? (
            <>
              <span className="text-sm font-extrabold text-[#DC2626]">
                {fmtPrice(Math.round(product.priceCents * (1 - product.promoPct / 100)))}
              </span>
              <span className="text-[10px] text-[#999] line-through">
                {fmtPrice(product.priceCents)}
              </span>
            </>
          ) : (
            <span className="text-sm font-extrabold text-[#2a2018]">
              {fmtPrice(product.priceCents)}
            </span>
          )}
          <span className="text-[10px] text-[#767676] font-semibold">
            {unitLabel(product.unit)}
          </span>
        </div>
        {/* Tags */}
        {product.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-[#f5f0eb] border border-[#e8e4df] rounded text-[8px] font-bold text-[#888]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* + Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="absolute right-2.5 bottom-2.5 w-7 h-7 rounded-lg bg-[#f5f0eb] border border-[#e8e3dc] flex items-center justify-center text-[#999] hover:bg-[#DC2626] hover:border-[#DC2626] hover:text-white transition-colors z-10"
      >
        <svg
          className="w-3.5 h-3.5 stroke-current stroke-[2.5] fill-none"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
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

  const filtered =
    activeCat === "Tout"
      ? products
      : products.filter((p) => p.category.id === activeCat);

  const handleAdd = useCallback(
    (p: ProductData) => {
      if (p.unit === "KG") {
        setSelectedProduct({
          id: p.id,
          name: p.name,
          description: p.description || "",
          imageUrl: p.imageUrl || getProductImage(p.category.name),
          category: p.category.name,
          unit: p.unit,
          priceCents: p.priceCents,
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
    [addItem, shopRef]
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
      {/* Sticky category pills */}
      <div className="sticky top-0 z-20 bg-[#f8f6f3]/95 backdrop-blur-xl px-5 py-3">
        <h2 className="text-lg font-bold text-[#2a2018] mb-2.5">Catalogue</h2>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setActiveCat("Tout")}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all border shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${
              activeCat === "Tout"
                ? "bg-[#DC2626] border-[#DC2626] text-white"
                : "bg-white border-[#e8e4df] text-[#999]"
            }`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all border shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${
                activeCat === c.id
                  ? "bg-[#DC2626] border-[#DC2626] text-white"
                  : "bg-white border-[#e8e4df] text-[#999]"
              }`}
            >
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 px-4 pb-24">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} productIndex={i} onAdd={() => handleAdd(p)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[#999] text-sm">
          Aucun produit dans cette categorie
        </div>
      )}

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-[#ece8e3] px-4 py-3 flex items-center justify-between shadow-lg z-50">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-[#2a2018]">
              {cartCount} article{cartCount > 1 ? "s" : ""}
            </span>
            <span className="text-sm text-[#7a7068] ml-2">{fmtPrice(totalCents)}</span>
          </div>
          <Button variant="default" className="bg-[#DC2626] hover:bg-[#DC2626]" asChild>
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
