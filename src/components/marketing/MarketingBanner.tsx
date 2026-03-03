// src/components/marketing/MarketingBanner.tsx — Promotional banners, popups & promo codes V2
"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Tag, Zap, ChevronLeft, ChevronRight, Copy, Check, Gift, Package } from "lucide-react";

type Banner = {
  id: string;
  name: string;
  imageUrl: string | null;
  linkUrl: string | null;
  bannerText: string | null;
  bannerColor?: string | null;
  bannerPosition?: string | null;
  code?: string | null;
};

type PromoCode = {
  id: string;
  code: string;
  discountType: string;
  valueCents: number | null;
  valuePercent: number | null;
  label: string;
  isFlash: boolean;
  endsAt: string;
};

type Popup = {
  id: string;
  popupTitle: string | null;
  popupMessage: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  popupColor?: string | null;
  popupFrequency?: string | null;
  code?: string | null;
};

const BANNER_GRADIENTS: Record<string, string> = {
  red: "from-[#DC2626] to-red-700",
  black: "from-gray-900 to-gray-700",
  green: "from-emerald-600 to-emerald-500",
  orange: "from-orange-500 to-amber-500",
  blue: "from-blue-600 to-blue-500",
};

const POPUP_BORDERS: Record<string, string> = {
  red: "border-[#DC2626]",
  black: "border-gray-900 dark:border-gray-200",
  green: "border-emerald-600",
  orange: "border-orange-500",
  blue: "border-blue-600",
};

const POPUP_BTN: Record<string, string> = {
  red: "bg-[#DC2626] hover:bg-red-700",
  black: "bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100",
  green: "bg-emerald-600 hover:bg-emerald-700",
  orange: "bg-orange-500 hover:bg-orange-600",
  blue: "bg-blue-600 hover:bg-blue-700",
};

// ── Popup frequency helpers ──
function shouldShowPopup(popup: Popup): boolean {
  const freq = popup.popupFrequency || "once_user";
  const key = `klikgo-popup-${popup.id}`;

  if (freq === "every_visit") {
    // Show if not seen in this page load (handled by component state)
    const sessionSeen = sessionStorage.getItem("klikgo-seen-popups") || "";
    return !sessionSeen.includes(popup.id);
  }

  if (freq === "once_day") {
    const lastSeen = localStorage.getItem(key);
    if (!lastSeen) return true;
    const dayAgo = Date.now() - 86400000;
    return parseInt(lastSeen) < dayAgo;
  }

  // once_user (default)
  return !localStorage.getItem(key);
}

function markPopupSeen(popup: Popup) {
  const freq = popup.popupFrequency || "once_user";
  const key = `klikgo-popup-${popup.id}`;

  if (freq === "every_visit") {
    const seen = sessionStorage.getItem("klikgo-seen-popups") || "";
    sessionStorage.setItem("klikgo-seen-popups", seen + popup.id + ",");
  } else {
    localStorage.setItem(key, String(Date.now()));
  }
}

export default function MarketingBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/active")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setBanners(json.data.banners || []);
          setPromoCodes(json.data.promoCodes || []);
          // Show popup respecting frequency
          const popups: Popup[] = json.data.popups || [];
          const eligible = popups.find((p) => shouldShowPopup(p));
          if (eligible) {
            setPopup(eligible);
            setTimeout(() => setShowPopup(true), 2000);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const dismissPopup = useCallback(() => {
    if (popup) markPopupSeen(popup);
    setShowPopup(false);
  }, [popup]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Nothing to show
  if (banners.length === 0 && promoCodes.length === 0 && !showPopup) return null;

  return (
    <>
      {/* ── Promo codes strip ── */}
      {promoCodes.length > 0 && !dismissed && (
        <div className="bg-gradient-to-r from-[#DC2626] to-red-700 text-white px-4 py-2.5 relative">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm">
            <Tag className="w-4 h-4 shrink-0" />
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
              {promoCodes.map((pc) => {
                const isCopied = copiedCode === pc.code;
                const discountIcon = pc.discountType === "BOGO" ? Gift : pc.discountType === "BUNDLE" ? Package : null;
                return (
                  <button
                    key={pc.id}
                    onClick={() => copyCode(pc.code)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition shrink-0 group"
                    title="Cliquer pour copier"
                  >
                    {pc.isFlash && <Zap className="w-3 h-3" />}
                    {discountIcon && (() => { const I = discountIcon; return <I className="w-3 h-3" />; })()}
                    <span className="font-mono font-bold">{pc.code}</span>
                    <span className="text-white/60">—</span>
                    <span className="text-white/90">{pc.label}</span>
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="w-3 h-3 text-white/40 group-hover:text-white/70 transition" />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Banner carousel ── */}
      {banners.length > 0 && (
        <div className="relative w-full max-w-7xl mx-auto mt-4 px-4">
          <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#141414]">
            {banners.map((banner, i) => {
              const gradient = BANNER_GRADIENTS[banner.bannerColor || "red"] || BANNER_GRADIENTS.red;
              return (
                <div
                  key={banner.id}
                  className={`transition-opacity duration-500 ${
                    i === currentBanner ? "opacity-100" : "opacity-0 absolute inset-0"
                  }`}
                >
                  {banner.imageUrl ? (
                    <Link href={banner.linkUrl || "#"}>
                      <div className="relative h-40 sm:h-56 lg:h-64">
                        <Image
                          src={banner.imageUrl}
                          alt={banner.name}
                          fill
                          className="object-cover"
                          quality={80}
                        />
                        {banner.bannerText && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="text-center px-4">
                              <h2 className="text-white text-xl sm:text-3xl font-bold font-display">
                                {banner.name}
                              </h2>
                              <p className="text-white/80 text-sm sm:text-base mt-1">{banner.bannerText}</p>
                              {banner.code && (
                                <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-lg px-4 py-1.5">
                                  <span className="font-mono font-bold text-sm">{banner.code}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div
                      className={`h-32 sm:h-40 flex items-center justify-center bg-gradient-to-r ${gradient} cursor-pointer`}
                      onClick={() => banner.code && copyCode(banner.code)}
                    >
                      <div className="text-center px-6">
                        <h2 className="text-white text-xl sm:text-3xl font-bold font-display">
                          {banner.name}
                        </h2>
                        {banner.bannerText && (
                          <p className="text-white/80 text-sm sm:text-base mt-1">{banner.bannerText}</p>
                        )}
                        {banner.code && (
                          <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-lg px-4 py-1.5">
                            <span className="font-mono font-bold text-sm text-white">{banner.code}</span>
                            <Copy className="w-3.5 h-3.5 text-white/60" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {banners.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-black/50 rounded-full shadow hover:bg-white transition"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-900 dark:text-white" />
                </button>
                <button
                  onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-black/50 rounded-full shadow hover:bg-white transition"
                >
                  <ChevronRight className="w-5 h-5 text-gray-900 dark:text-white" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentBanner(i)}
                      className={`w-2 h-2 rounded-full transition ${
                        i === currentBanner ? "bg-white w-4" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Popup modal V2 ── */}
      {showPopup && popup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`bg-white dark:bg-[#141414] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in border-2 ${
            POPUP_BORDERS[popup.popupColor || "red"] || POPUP_BORDERS.red
          }`}>
            {popup.imageUrl && (
              <div className="relative h-44">
                <Image
                  src={popup.imageUrl}
                  alt={popup.popupTitle || "Promotion"}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-5 text-center">
              {popup.popupTitle && (
                <h2 className="text-xl font-bold text-gray-900 dark:text-white font-display">
                  {popup.popupTitle}
                </h2>
              )}
              {popup.popupMessage && (
                <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm leading-relaxed">
                  {popup.popupMessage}
                </p>
              )}
              {popup.code && (
                <button
                  onClick={() => copyCode(popup.code!)}
                  className="mt-3 inline-flex items-center gap-2 bg-gray-100 dark:bg-white/10 rounded-lg px-4 py-2 hover:bg-gray-200 dark:hover:bg-white/15 transition"
                >
                  <Tag className="w-4 h-4 text-[#DC2626]" />
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{popup.code}</span>
                  {copiedCode === popup.code ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              )}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={dismissPopup}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-semibold rounded-xl text-sm"
                >
                  Plus tard
                </button>
                {popup.linkUrl ? (
                  <Link
                    href={popup.linkUrl}
                    onClick={dismissPopup}
                    className={`flex-1 py-2.5 text-white font-semibold rounded-xl text-sm text-center transition ${
                      POPUP_BTN[popup.popupColor || "red"] || POPUP_BTN.red
                    }`}
                  >
                    En profiter
                  </Link>
                ) : (
                  <button
                    onClick={dismissPopup}
                    className={`flex-1 py-2.5 text-white font-semibold rounded-xl text-sm transition ${
                      POPUP_BTN[popup.popupColor || "red"] || POPUP_BTN.red
                    }`}
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={dismissPopup}
              className="absolute top-3 right-3 p-1.5 bg-black/30 hover:bg-black/50 rounded-full transition"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
