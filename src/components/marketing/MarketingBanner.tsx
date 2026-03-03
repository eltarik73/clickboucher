// src/components/marketing/MarketingBanner.tsx — Promotional banner on homepage
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Tag, Zap, ChevronLeft, ChevronRight } from "lucide-react";

type Banner = {
  id: string;
  name: string;
  imageUrl: string | null;
  linkUrl: string | null;
  bannerText: string | null;
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
};

export default function MarketingBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/marketing/active")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setBanners(json.data.banners || []);
          setPromoCodes(json.data.promoCodes || []);
          // Show popup only once per session
          const popups = json.data.popups || [];
          if (popups.length > 0) {
            const seenPopups = sessionStorage.getItem("klikgo-seen-popups") || "";
            const unseen = popups.find((p: Popup) => !seenPopups.includes(p.id));
            if (unseen) {
              setPopup(unseen);
              setTimeout(() => setShowPopup(true), 2000); // 2s delay
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const dismissPopup = () => {
    if (popup) {
      const seen = sessionStorage.getItem("klikgo-seen-popups") || "";
      sessionStorage.setItem("klikgo-seen-popups", seen + popup.id + ",");
    }
    setShowPopup(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
  };

  // Nothing to show
  if (banners.length === 0 && promoCodes.length === 0 && !showPopup) return null;

  return (
    <>
      {/* Promo codes strip */}
      {promoCodes.length > 0 && !dismissed && (
        <div className="bg-gradient-to-r from-[#DC2626] to-red-700 text-white px-4 py-2.5 relative">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm">
            <Tag className="w-4 h-4 shrink-0" />
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
              {promoCodes.map((pc) => (
                <button
                  key={pc.id}
                  onClick={() => copyCode(pc.code)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition shrink-0"
                  title="Cliquer pour copier"
                >
                  {pc.isFlash && <Zap className="w-3 h-3" />}
                  <span className="font-mono font-bold">{pc.code}</span>
                  <span className="text-white/80">—</span>
                  <span>{pc.label}</span>
                </button>
              ))}
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

      {/* Banner carousel */}
      {banners.length > 0 && (
        <div className="relative w-full max-w-7xl mx-auto mt-4 px-4">
          <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#141414]">
            {banners.map((banner, i) => (
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
                          <h2 className="text-white text-xl sm:text-3xl font-bold text-center px-4 font-display">
                            {banner.bannerText}
                          </h2>
                        </div>
                      )}
                    </div>
                  </Link>
                ) : banner.bannerText ? (
                  <Link href={banner.linkUrl || "#"} className="block h-32 sm:h-40 flex items-center justify-center bg-gradient-to-r from-[#DC2626] to-red-800">
                    <h2 className="text-white text-xl sm:text-3xl font-bold text-center px-4 font-display">
                      {banner.bannerText}
                    </h2>
                  </Link>
                ) : null}
              </div>
            ))}
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
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition ${
                        i === currentBanner ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Popup */}
      {showPopup && popup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in">
            {popup.imageUrl && (
              <div className="relative h-40">
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
                <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                  {popup.popupMessage}
                </p>
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
                    className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl text-sm text-center hover:bg-red-700 transition"
                  >
                    En profiter
                  </Link>
                ) : (
                  <button
                    onClick={dismissPopup}
                    className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl text-sm hover:bg-red-700 transition"
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
