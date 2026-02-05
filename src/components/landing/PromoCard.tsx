// src/components/landing/PromoCard.tsx
"use client";

export interface Promo {
  id: string;
  title: string;
  discount: string;
  originalPrice: number;
  shop: string;
}

interface Props {
  promo: Promo;
}

export function PromoCard({ promo }: Props) {
  const discountedPrice = promo.originalPrice * (1 - parseInt(promo.discount) / 100);

  return (
    <div className="bg-white rounded-xl border border-[#E8E5E1] p-3.5 hover:border-[#DC2626]/30 hover:shadow-sm transition-all cursor-pointer group">
      <div className="flex items-start gap-3">
        {/* Discount badge */}
        <div className="w-12 h-12 rounded-lg bg-[#DC2626] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">{promo.discount}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[#1A1A1A] truncate group-hover:text-[#DC2626] transition-colors">
            {promo.title}
          </h4>
          <p className="text-xs text-[#9C9590] mt-0.5">
            Chez {promo.shop}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-bold text-[#DC2626]">
              {discountedPrice.toFixed(2)}&euro;/kg
            </span>
            <span className="text-xs text-[#9C9590] line-through">
              {promo.originalPrice.toFixed(2)}&euro;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
