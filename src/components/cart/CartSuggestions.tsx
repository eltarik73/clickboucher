"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useCart } from "@/lib/hooks/use-cart";

type SuggestedProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  category?: string;
  promoPct?: number | null;
};

export default function CartSuggestions() {
  const { state, addItem } = useCart();
  const [suggestions, setSuggestions] = useState<SuggestedProduct[]>([]);

  useEffect(() => {
    if (!state.shopId || state.items.length === 0) {
      setSuggestions([]);
      return;
    }

    const productIds = state.items.map((i) => i.productId || i.id).join(",");

    fetch(`/api/suggestions?shopId=${state.shopId}&productIds=${productIds}`)
      .then((r) => r.json())
      .then((json) => setSuggestions(json.data || []))
      .catch(() => setSuggestions([]));
  }, [state.shopId, state.items]);

  if (suggestions.length === 0) return null;

  function handleAdd(product: SuggestedProduct) {
    if (!state.shopId || !state.shopName || !state.shopSlug) return;

    addItem(
      {
        id: product.id,
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl || "",
        priceCents: product.priceCents,
        unit: product.unit as "KG" | "PIECE" | "BARQUETTE",
        quantity: 1,
      },
      { id: state.shopId, name: state.shopName, slug: state.shopSlug }
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Vous aimerez aussi
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {suggestions.map((product) => {
          const price = product.promoPct
            ? Math.round(product.priceCents * (1 - product.promoPct / 100))
            : product.priceCents;
          const unitLabel = product.unit === "KG" ? "/kg" : "";

          return (
            <div
              key={product.id}
              className="shrink-0 w-[140px] bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 overflow-hidden shadow-sm"
            >
              <div className="relative h-[90px]">
                <img
                  src={product.imageUrl || "/img/products/boeuf-1.jpg"}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.promoPct && (
                  <span className="absolute top-1.5 left-1.5 bg-[#DC2626] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    -{product.promoPct}%
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {product.name}
                </p>
                {product.category && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {product.category}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {(price / 100).toFixed(2).replace(".", ",")} &euro;{unitLabel}
                  </span>
                  <button
                    onClick={() => handleAdd(product)}
                    className="w-7 h-7 rounded-full bg-[#DC2626] flex items-center justify-center text-white hover:bg-[#b91c1c] transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
