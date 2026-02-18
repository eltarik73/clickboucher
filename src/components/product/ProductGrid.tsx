// src/components/product/ProductGrid.tsx — Uber Eats style tight grid
"use client";

import { ProductCard, type ProductCardData } from "./ProductCard";

interface Props {
  products: ProductCardData[];
  loading?: boolean;
  onAdd: (product: ProductCardData) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200 dark:bg-white/[0.06]" />
      <div className="px-1.5 pt-1.5 pb-2">
        <div className="h-3 w-3/4 bg-gray-200 dark:bg-white/[0.06] rounded" />
        <div className="h-3.5 w-1/2 bg-gray-200 dark:bg-white/[0.06] rounded mt-1" />
      </div>
    </div>
  );
}

export function ProductGrid({ products, loading = false, onAdd }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 px-3 pb-24">
        {Array.from({ length: 9 }).map((_, i) => (
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
    <div className="grid grid-cols-3 gap-2 px-3 pb-24">
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          productIndex={i}
          onAdd={() => onAdd(p)}
        />
      ))}
    </div>
  );
}
