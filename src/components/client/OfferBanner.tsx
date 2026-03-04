"use client";

import { useState } from "react";
import { X } from "lucide-react";

const gradientMap: Record<string, string> = {
  red: "from-red-500 to-red-700",
  black: "from-gray-800 to-gray-950",
  green: "from-emerald-500 to-emerald-700",
  orange: "from-orange-500 to-amber-600",
  blue: "from-blue-500 to-indigo-600",
};

export function OfferBanner({
  title,
  subtitle,
  code,
  color,
  discountLabel,
  imageUrl,
}: {
  title: string;
  subtitle?: string | null;
  code: string;
  color: string;
  discountLabel: string;
  imageUrl?: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const gradient = gradientMap[color] || gradientMap.red;

  return (
    <div
      className={`${imageUrl ? "" : `bg-gradient-to-r ${gradient}`} rounded-xl p-5 text-white relative overflow-hidden`}
      style={imageUrl ? {
        backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.65), rgba(0,0,0,0.3)), url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {/* Decorative circle (only when no image) */}
      {!imageUrl && (
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
      )}

      {/* Close button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
        aria-label="Fermer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center justify-between gap-4">
        {/* Left side */}
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{title}</p>
          {subtitle && (
            <p className="text-sm text-white/70 mt-1">{subtitle}</p>
          )}
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="bg-white/20 rounded-lg px-3 py-1 font-bold text-sm">
            {discountLabel}
          </span>
          <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-xs">
            {code}
          </span>
        </div>
      </div>
    </div>
  );
}
