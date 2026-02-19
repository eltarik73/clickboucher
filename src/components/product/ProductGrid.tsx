// src/components/product/ProductGrid.tsx — responsive auto-fill grid (2/3/4 cols) with inline stepper
"use client";

import { ProductCard, type ProductCardData } from "./ProductCard";

interface CartItemInfo {
  id: string;
  quantity: number;
}

interface Props {
  products: ProductCardData[];
  loading?: boolean;
  onAdd: (product: ProductCardData) => void;
  onTap?: (product: ProductCardData) => void;
  cartItems?: CartItemInfo[];
  onIncrement?: (productId: string) => void;
  onDecrement?: (productId: string) => void;
}

const GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: "8px",
} as const;

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gray-200 dark:bg-white/[0.06]" />
      <div className="px-2 pt-1.5 pb-2">
        <div className="h-3 w-3/4 bg-gray-200 dark:bg-white/[0.06] rounded mb-[3px]" />
        <div className="flex gap-[3px] mb-1">
          <div className="h-3 w-6 bg-gray-200 dark:bg-white/[0.06] rounded-[3px]" />
          <div className="h-3 w-5 bg-gray-200 dark:bg-white/[0.06] rounded-[3px]" />
        </div>
        <div className="flex justify-between items-center">
          <div className="h-4 w-16 bg-gray-200 dark:bg-white/[0.06] rounded" />
          <div className="w-[26px] h-[26px] bg-gray-200 dark:bg-white/[0.06] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ products, loading = false, onAdd, onTap, cartItems = [], onIncrement, onDecrement }: Props) {
  if (loading) {
    return (
      <div className="px-3 pb-24" style={GRID_STYLE}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Aucun produit</p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-24" style={GRID_STYLE}>
      {products.map((p, i) => {
        const cartItem = cartItems.find(ci => ci.id === p.id);
        return (
          <ProductCard
            key={p.id}
            product={p}
            productIndex={i}
            onAdd={() => onAdd(p)}
            onTap={onTap ? () => onTap(p) : undefined}
            cartQty={cartItem?.quantity ?? 0}
            onIncrement={onIncrement ? () => onIncrement(p.id) : undefined}
            onDecrement={onDecrement ? () => onDecrement(p.id) : undefined}
          />
        );
      })}
    </div>
  );
}
