"use client";

/**
 * KlikLogo — Logo rond Klik&Go (cercle rouge + K blanc + 3 traits de vitesse)
 * Réutilisable partout : header, sidebar, splash, email preview, etc.
 */
export function KlikLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="Klik&Go"
    >
      <defs>
        <linearGradient id="klikLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a83320" />
          <stop offset="50%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      {/* Cercle rouge */}
      <circle cx="50" cy="50" r="46" fill="url(#klikLogoGrad)" />
      {/* K blanc */}
      <path
        d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z"
        fill="white"
      />
      {/* 3 traits de vitesse (rect dégradés) */}
      <rect x="76" y="33" width="14" height="3.5" rx="1.75" fill="white" opacity="0.7" />
      <rect x="79" y="43" width="16" height="3" rx="1.5" fill="white" opacity="0.5" />
      <rect x="76" y="53" width="12" height="2.5" rx="1.25" fill="white" opacity="0.3" />
    </svg>
  );
}

/**
 * KlikWordmark — Texte "Klik&Go" avec le "&" en rouge bold
 */
export function KlikWordmark({
  size = "base",
  className = "",
}: {
  size?: "sm" | "base" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
  };

  return (
    <span className={`font-extrabold tracking-tight ${sizeClasses[size]} ${className}`} style={{ fontWeight: 800 }}>
      <span className="text-gray-900 dark:text-white">Klik</span>
      <span className="text-[#DC2626] not-italic" style={{ fontWeight: 900 }}>&amp;</span>
      <span className="text-gray-900 dark:text-white">Go</span>
    </span>
  );
}
