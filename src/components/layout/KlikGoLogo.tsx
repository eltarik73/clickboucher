import { BrandLogo, type WordmarkSize } from "@/components/brand/BrandLogo";
import { SecretTapLogo } from "@/components/layout/SecretTapLogo";

export function KlikGoLogo({
  logoSize = 40,
  wordmarkSize = "lg",
}: {
  logoSize?: number;
  wordmarkSize?: WordmarkSize;
}) {
  return (
    <SecretTapLogo>
      <BrandLogo variant="lockup" markSize={logoSize} wordmarkSize={wordmarkSize} />
    </SecretTapLogo>
  );
}
