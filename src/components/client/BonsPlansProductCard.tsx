// src/components/client/BonsPlansProductCard.tsx — Clickable product card wrapper for bons-plans pages
"use client";

import { useState } from "react";
import { ProductQuickAdd, type QuickAddProduct, type QuickAddShop } from "./ProductQuickAdd";

interface Props {
  product: QuickAddProduct;
  shop: QuickAddShop;
  children: React.ReactNode;
}

export function BonsPlansProductCard({ product, shop, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") setIsOpen(true); }}
      >
        {children}
      </div>
      <ProductQuickAdd
        product={product}
        shop={shop}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
