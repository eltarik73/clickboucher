// src/components/client/OfferPopup.tsx — Promo popup on /decouvrir
"use client";

import { useState, useEffect } from "react";
import { X, Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type OfferPopupData = {
  id: string;
  name: string;
  code: string;
  type: string;
  discountValue: number;
  popupTitle?: string | null;
  popupMessage?: string | null;
  popupColor?: string | null;
  popupFrequency?: string | null;
  popupImageUrl?: string | null;
};

type Props = {
  offers: OfferPopupData[];
};

const COLOR_MAP: Record<string, string> = {
  red: "from-red-600 to-red-800",
  black: "from-gray-800 to-black",
  green: "from-emerald-600 to-emerald-800",
  orange: "from-orange-500 to-orange-700",
  blue: "from-blue-600 to-blue-800",
};

function getDiscountLabel(type: string, value: number) {
  switch (type) {
    case "PERCENT": return `-${value}%`;
    case "AMOUNT": return `-${value}€`;
    case "FREE_DELIVERY": return "Frais offerts";
    case "BOGO": return "1+1 offert";
    case "BUNDLE": return `Pack -${value}%`;
    default: return "Offre";
  }
}

export function OfferPopup({ offers }: Props) {
  const [visible, setVisible] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<OfferPopupData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (offers.length === 0) return;

    // Find the first offer not yet dismissed (frequency check)
    const eligible = offers.find((offer) => {
      const freq = offer.popupFrequency || "once_user";
      const key = `klikgo-popup-${offer.id}`;
      const stored = localStorage.getItem(key);

      if (freq === "once_user" && stored) return false;
      if (freq === "once_session" && sessionStorage.getItem(key)) return false;
      if (freq === "once_day" && stored) {
        const lastShown = parseInt(stored, 10);
        if (Date.now() - lastShown < 86400000) return false;
      }
      return true;
    });

    if (eligible) {
      // Small delay before showing popup
      const timer = setTimeout(() => {
        setCurrentOffer(eligible);
        setVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [offers]);

  const dismiss = () => {
    if (currentOffer) {
      const key = `klikgo-popup-${currentOffer.id}`;
      const freq = currentOffer.popupFrequency || "once_user";
      if (freq === "once_session") {
        sessionStorage.setItem(key, "1");
      } else {
        localStorage.setItem(key, String(Date.now()));
      }
    }
    setVisible(false);
  };

  const handleCopy = () => {
    if (!currentOffer) return;
    navigator.clipboard.writeText(currentOffer.code).then(() => {
      setCopied(true);
      toast.success("Code copié !");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!visible || !currentOffer) return null;

  const gradient = COLOR_MAP[currentOffer.popupColor || "red"] || COLOR_MAP.red;
  const title = currentOffer.popupTitle || currentOffer.name;
  const message = currentOffer.popupMessage || `Utilisez le code ${currentOffer.code} pour profiter de cette offre !`;
  const discountLabel = getDiscountLabel(currentOffer.type, currentOffer.discountValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${gradient} p-6 text-center relative`}>
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "16px 16px",
            }}
          />
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative z-10">
            <Gift className="w-10 h-10 text-white mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <span className="inline-block mt-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-lg font-extrabold">
              {discountLabel}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-[#141414] p-5 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-lg font-mono font-bold text-gray-900 dark:text-white hover:border-[#DC2626] transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
            {currentOffer.code}
          </button>
          <button
            onClick={dismiss}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Non merci
          </button>
        </div>
      </div>
    </div>
  );
}
