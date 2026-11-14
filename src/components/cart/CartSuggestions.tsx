"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useCart } from "@/lib/hooks/use-cart";
import { cartLineId, type CartItem } from "@/lib/cart/cart-line";
import { displayedUnitPrice } from "@/lib/pricing/display";
import { isWeighedUnit, type SaleUnit } from "@/lib/pricing/line";
import { formatPrice } from "@/lib/utils";

type SuggestedProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  unit: SaleUnit;
  category?: string;
  promoPct?: number | null;
  promoType?: string | null;
  promoEnd?: string | null;
  promoFixedCents?: number | null;
};

/** A suggestion with its public unit price, resolved when the list was received. */
type PricedSuggestion = SuggestedProduct & { unitPriceCents: number; promoPctShown: number | null };

/** One weighed portion added from a suggestion: what an untyped line was billed before chantier 0. */
const SUGGESTED_PORTION_GRAMS = 1000;

function priceSuggestions(products: SuggestedProduct[], now: Date): PricedSuggestion[] {
  return products.map((product) => {
    const price = displayedUnitPrice(product, now);
    return {
      ...product,
      unitPriceCents: price.unitPriceCents,
      promoPctShown: price.promo?.kind === "PERCENT" ? price.promo.pct : null,
    };
  });
}

function suggestionLine(product: PricedSuggestion): CartItem {
  const base = {
    productId: product.id,
    name: product.name,
    imageUrl: product.imageUrl || "",
    priceCents: product.unitPriceCents,
    quantity: 1,
    category: product.category,
  };
  if (isWeighedUnit(product.unit)) {
    const line = {
      productId: product.id,
      unit: product.unit,
      weightGrams: SUGGESTED_PORTION_GRAMS,
    };
    return { ...base, ...line, id: cartLineId(line) };
  }
  const line = { productId: product.id, unit: product.unit };
  return { ...base, ...line, id: cartLineId(line) };
}

export default function CartSuggestions() {
  const { state, addItem } = useCart();
  const [suggestions, setSuggestions] = useState<PricedSuggestion[]>([]);

  useEffect(() => {
    if (!state.shopId || state.items.length === 0) {
      setSuggestions([]);
      return;
    }

    const productIds = state.items.map((i) => i.productId || i.id).join(",");

    fetch(`/api/suggestions?shopId=${state.shopId}&productIds=${productIds}`)
      .then((r) => r.json())
      .then((json: { data?: SuggestedProduct[] }) =>
        setSuggestions(priceSuggestions(json.data ?? [], new Date()))
      )
      .catch(() => setSuggestions([]));
  }, [state.shopId, state.items]);

  if (suggestions.length === 0) return null;

  function handleAdd(product: PricedSuggestion) {
    if (!state.shopId || !state.shopName || !state.shopSlug) return;
    addItem(suggestionLine(product), {
      id: state.shopId,
      name: state.shopName,
      slug: state.shopSlug,
    });
  }

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
        Vous aimerez aussi
      </h3>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {suggestions.map((product) => {
          const unitLabel = isWeighedUnit(product.unit) ? "/kg" : "";

          return (
            <div
              key={product.id}
              className="w-[140px] shrink-0 overflow-hidden rounded-xl border border-[#ece8e3] bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]"
            >
              <div className="relative h-[90px]">
                <img
                  src={product.imageUrl || "/img/products/boeuf-1.jpg"}
                  alt={product.name}
                  width={140}
                  height={90}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {product.promoPctShown !== null && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                    -{product.promoPctShown}%
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium text-gray-900 dark:text-white">
                  {product.name}
                </p>
                {product.category && (
                  <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">
                    {product.category}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {formatPrice(product.unitPriceCents)}
                    {unitLabel}
                  </span>
                  <button
                    onClick={() => handleAdd(product)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-[#b91c1c]"
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
