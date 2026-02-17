// src/components/product/ProductGrid.tsx — Responsive product grid with loading state
"use client";

import { ProductCard, type ProductCardData } from "./ProductCard";

interface Props {
  products: ProductCardData[];
  loading?: boolean;
  onAdd: (product: ProductCardData) => void;
}

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-white dark:bg-white/[0.03] border border-[#ece8e3] dark:border-white/[0.06] rounded-[16px] overflow-hidden animate-pulse">
      <div className="w-full aspect-[4/3] bg-gray-200 dark:bg-white/10" />
      <div className="p-2 space-y-1.5">
        <div className="h-2 w-12 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="flex gap-1 mt-1">
          <div className="h-2.5 w-10 bg-gray-100 dark:bg-white/5 rounded" />
          <div className="h-2.5 w-8 bg-gray-100 dark:bg-white/5 rounded" />
        </div>
        <div className="flex items-end justify-between mt-1.5">
          <div className="h-4 w-14 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-8 w-16 bg-gray-200 dark:bg-white/10 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ products, loading = false, onAdd }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 px-3 pb-24">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucun produit trouvé</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Essayez une autre catégorie ou recherche</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 px-3 pb-24">
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          productIndex={i}
          onAdd={() => onAdd(p)}
          style={{ animationDelay: `${i * 30}ms` }}
        />
      ))}
    </div>
  );
}
