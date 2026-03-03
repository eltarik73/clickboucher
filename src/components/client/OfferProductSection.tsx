// src/components/client/OfferProductSection.tsx — "Offres en cours" product highlight section
"use client";

import Image from "next/image";
import { Gift, Tag, ShoppingBag } from "lucide-react";

type OfferProductData = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  offerName: string;
  offerType: string;
  discountValue: number;
  offerCode: string;
};

type Props = {
  products: OfferProductData[];
  onAddToCart?: (productId: string) => void;
};

function getDiscountLabel(type: string, value: number) {
  switch (type) {
    case "PERCENT": return `-${value}%`;
    case "AMOUNT": return `-${value}€`;
    case "FREE_DELIVERY": return "Frais offerts";
    case "BOGO": return "1+1 offert";
    case "BUNDLE": return `Pack -${value}%`;
    default: return "Offre";
  }
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export function OfferProductSection({ products, onAddToCart }: Props) {
  if (products.length === 0) return null;

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-[#DC2626]/10 rounded-xl flex items-center justify-center">
          <Gift className="w-4 h-4 text-[#DC2626]" />
        </div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          Offres en cours
        </h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {products.map((product) => (
          <div
            key={product.id}
            className="min-w-[160px] max-w-[160px] bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 overflow-hidden shrink-0"
          >
            <div className="relative h-24 bg-gray-100 dark:bg-gray-800">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                </div>
              )}
              <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-[#DC2626] text-white text-[9px] font-bold rounded-full">
                <Tag className="w-2 h-2" />
                {getDiscountLabel(product.offerType, product.discountValue)}
              </span>
            </div>
            <div className="p-2.5">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                {product.name}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                {product.offerName}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {fmtPrice(product.priceCents)}
                  {product.unit === "KG" ? "/kg" : ""}
                </span>
                {onAddToCart && (
                  <button
                    onClick={() => onAddToCart(product.id)}
                    className="w-6 h-6 bg-[#DC2626] rounded-full flex items-center justify-center text-white hover:bg-[#b91c1c] transition-colors"
                  >
                    <span className="text-xs font-bold">+</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
