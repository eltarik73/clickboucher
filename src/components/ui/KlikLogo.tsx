import * as React from "react";
import { cn } from "@/lib/utils";

export type WordmarkSize = "sm" | "base" | "lg" | "xl";

const WORDMARK_SIZE_CLASSES: Record<WordmarkSize, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
};

interface KlikLogoProps {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}

/** The Klik&Go mark: gradient disc, white K, three speed lines. */
function KlikLogo({ size = 40, className, "aria-hidden": hidden }: KlikLogoProps) {
  // Two marks on one page need two gradient ids; the colons of useId are not valid in url(#…).
  const gradientId = `brand-mark-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // A hidden mark needs no name: beside the wordmark, the text already reads Klik&Go.
  const a11y = hidden ? { "aria-hidden": true } : { role: "img", "aria-label": "Klik&Go" };
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size }}
      className={cn("rounded-full", className)}
      {...a11y}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a83320" />
          <stop offset="50%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${gradientId})`} />
      <path
        d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z"
        fill="white"
      />
      <rect x="76" y="33" width="14" height="3.5" rx="1.75" fill="white" opacity="0.7" />
      <rect x="79" y="43" width="16" height="3" rx="1.5" fill="white" opacity="0.5" />
      <rect x="76" y="53" width="12" height="2.5" rx="1.25" fill="white" opacity="0.3" />
    </svg>
  );
}

function KlikWordmark({ size = "base", className }: { size?: WordmarkSize; className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight", WORDMARK_SIZE_CLASSES[size], className)}>
      <span className="text-foreground">Klik</span>
      <span className="font-black not-italic text-primary">&amp;</span>
      <span className="text-foreground">Go</span>
    </span>
  );
}

export { KlikLogo, KlikWordmark };
