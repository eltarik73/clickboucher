// src/components/client/OfferBanner.tsx — Gradient banner on boutique page
"use client";

import { Gift, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type OfferBannerProps = {
  title: string;
  subtitle?: string | null;
  code: string;
  color?: string;
  discountLabel: string;
};

const COLOR_MAP: Record<string, string> = {
  red: "from-red-600 to-red-800",
  black: "from-gray-800 to-black",
  green: "from-emerald-600 to-emerald-800",
  orange: "from-orange-500 to-orange-700",
  blue: "from-blue-600 to-blue-800",
};

export function OfferBanner({ title, subtitle, code, color = "red", discountLabel }: OfferBannerProps) {
  const [copied, setCopied] = useState(false);
  const gradient = COLOR_MAP[color] || COLOR_MAP.red;

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Code copié !");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`mx-3 mt-2 rounded-2xl bg-gradient-to-r ${gradient} p-4 sm:p-5 relative overflow-hidden`}>
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="relative z-10 flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
          <Gift className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold">{title}</p>
          {subtitle && (
            <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-bold">
              {discountLabel}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1 bg-white rounded-lg text-gray-900 text-xs font-bold hover:bg-white/90 transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {code}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
