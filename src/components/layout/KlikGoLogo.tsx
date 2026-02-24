"use client";

import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { SecretTapLogo } from "@/components/layout/SecretTapLogo";

export function KlikGoLogo({ logoSize = 40, wordmarkSize = "lg" as const }) {
  return (
    <SecretTapLogo>
      <span className="flex items-center gap-2.5">
        <KlikLogo size={logoSize} className="shadow-lg shadow-[#DC2626]/20" />
        <KlikWordmark size={wordmarkSize} />
      </span>
    </SecretTapLogo>
  );
}
