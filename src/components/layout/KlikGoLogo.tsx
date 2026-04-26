import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { SecretTapLogo } from "@/components/layout/SecretTapLogo";

export function KlikGoLogo({ logoSize = 40, wordmarkSize = "lg" }: { logoSize?: number; wordmarkSize?: "sm" | "base" | "lg" | "xl" }) {
  return (
    <SecretTapLogo>
      <span className="flex items-center gap-2.5">
        <KlikLogo size={logoSize} />
        <KlikWordmark size={wordmarkSize} />
      </span>
    </SecretTapLogo>
  );
}
