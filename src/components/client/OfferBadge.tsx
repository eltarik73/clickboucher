// src/components/client/OfferBadge.tsx — Promo badge on shop cards
"use client";

import { Tag } from "lucide-react";

type OfferBadgeProps = {
  label: string;
};

export function OfferBadge({ label }: OfferBadgeProps) {
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-[#DC2626] text-white text-[10px] font-bold rounded-full shadow-sm">
      <Tag className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
