// src/components/product/EstimationBadge.tsx
"use client";

import { computeEstimation, formatEstimation, formatEstimationShort } from "@/lib/estimate";
import type { ConversionProfile } from "@/lib/conversion-config";

interface Props {
  quantiteG: number;
  category: string;
  profil?: ConversionProfile;
  variant?: "inline" | "short";
  className?: string;
}

export function EstimationBadge({ quantiteG, category, profil = "standard", variant = "inline", className = "" }: Props) {
  if (quantiteG <= 0) return null;
  const est = computeEstimation(quantiteG, category, profil);
  const text = variant === "short" ? formatEstimationShort(est) : formatEstimation(est);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-[#9C9590] ${className}`}>
      <span>💡</span><span>{text}</span>
    </span>
  );
}
