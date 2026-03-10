"use client";

import { useState, useEffect } from "react";
/* eslint-disable @next/next/no-img-element */

type PopupOffer = {
  id: string;
  name: string;
  code: string;
  type: string;
  discountValue: number;
  popupTitle: string | null;
  popupMessage: string | null;
  popupColor: string | null;
  popupFrequency: string | null;
  popupImageUrl: string | null;
};

const gradientMap: Record<string, string> = {
  red: "from-red-500 to-red-700",
  black: "from-gray-800 to-gray-950",
  green: "from-emerald-500 to-emerald-700",
  orange: "from-orange-500 to-amber-600",
  blue: "from-blue-500 to-indigo-600",
};

function getEmoji(type: string): string {
  switch (type) {
    case "FREE_DELIVERY":
      return "\u{1F680}";
    case "PERCENT":
      return "\u{1F4B0}";
    case "BOGO":
      return "\u{1F381}";
    case "AMOUNT":
      return "\u{1F3F7}\uFE0F";
    case "BUNDLE":
      return "\u{1F4E6}";
    default:
      return "\u{1F4B0}";
  }
}

function shouldShow(offer: PopupOffer): boolean {
  if (typeof window === "undefined") return false;

  const freq = offer.popupFrequency || "every_visit";

  try {
    if (freq === "once_user") {
      const key = `popup_seen_${offer.id}`;
      if (localStorage.getItem(key)) return false;
    }

    if (freq === "once_day") {
      const today = new Date().toISOString().slice(0, 10);
      const key = `popup_day_${offer.id}_${today}`;
      if (localStorage.getItem(key)) return false;
    }
  } catch {
    // localStorage may be unavailable (private browsing, storage full, etc.)
  }

  // "every_visit" always shows
  return true;
}

function markSeen(offer: PopupOffer): void {
  if (typeof window === "undefined") return;

  const freq = offer.popupFrequency || "every_visit";

  try {
    if (freq === "once_user") {
      localStorage.setItem(`popup_seen_${offer.id}`, "true");
    }

    if (freq === "once_day") {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`popup_day_${offer.id}_${today}`, "true");
    }
  } catch {
    // localStorage may be unavailable
  }
}

export function OfferPopup({ offers }: { offers: PopupOffer[] }) {
  const [activeOffer, setActiveOffer] = useState<PopupOffer | null>(null);

  useEffect(() => {
    const eligible = offers.find((o) => shouldShow(o));
    if (eligible) {
      setActiveOffer(eligible);
    }
  }, [offers]);

  if (!activeOffer) return null;

  const gradient =
    gradientMap[activeOffer.popupColor || "red"] || gradientMap.red;
  const emoji = getEmoji(activeOffer.type);

  const handleClose = () => {
    markSeen(activeOffer);
    setActiveOffer(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-[#141414] rounded-2xl max-w-sm w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`bg-gradient-to-r ${gradient} py-6 text-center text-white`}
        >
          {activeOffer.popupImageUrl ? (
            <div className="relative w-full h-32 mb-2">
              <img
                src={activeOffer.popupImageUrl}
                alt={activeOffer.popupTitle || activeOffer.name}
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          ) : (
            <span className="text-4xl block mb-2">{emoji}</span>
          )}
          <h3 className="text-xl font-bold px-4">
            {activeOffer.popupTitle || activeOffer.name}
          </h3>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {activeOffer.popupMessage && (
            <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-4">
              {activeOffer.popupMessage}
            </p>
          )}

          {/* Code display */}
          <div className="bg-gray-100 dark:bg-white/10 font-mono text-center py-2 rounded-lg text-lg font-bold text-red-600 mb-4">
            {activeOffer.code}
          </div>

          {/* CTA */}
          <button
            onClick={handleClose}
            className="bg-red-600 hover:bg-red-700 text-white w-full rounded-xl py-3 font-bold transition-colors"
          >
            En profiter &rarr;
          </button>

          {/* Close text */}
          <button
            onClick={handleClose}
            className="w-full text-center text-sm text-gray-500 dark:text-gray-400 mt-3 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Non merci
          </button>
        </div>
      </div>
    </div>
  );
}
