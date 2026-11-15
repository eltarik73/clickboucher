import { SecretTapLogo } from "@/components/layout/SecretTapLogo";
import { KlikLogo, KlikWordmark, type WordmarkSize } from "@/components/ui/KlikLogo";

export function KlikGoLogo({
  logoSize = 40,
  wordmarkSize = "lg",
}: {
  logoSize?: number;
  wordmarkSize?: WordmarkSize;
}) {
  return (
    <SecretTapLogo>
      <span className="inline-flex items-center gap-2.5 align-middle">
        <KlikLogo size={logoSize} aria-hidden />
        <KlikWordmark size={wordmarkSize} />
      </span>
    </SecretTapLogo>
  );
}
