import { BrandLogo, type WordmarkSize } from "@/components/brand/BrandLogo";

export function KlikLogo({ size = 40, className }: { size?: number; className?: string }) {
  return <BrandLogo variant="mark" markSize={size} className={className} />;
}

export function KlikWordmark({ size = "base", className }: { size?: WordmarkSize; className?: string }) {
  return <BrandLogo variant="wordmark" wordmarkSize={size} className={className} />;
}
