// src/components/shop/ShopCard.tsx — Unified shop card with variants
"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Star, Tag } from "lucide-react";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { SafeImage } from "@/components/ui/SafeImage";
import { getShopImage } from "@/lib/product-images";
import { getShopStatus, formatClosingHint, type OpeningHours } from "@/lib/shop-hours";

export type ShopCardData = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  imageUrl: string | null;
  prepTimeMin: number;
  busyMode: boolean;
  busyExtraMin: number;
  status: string;
  rating: number;
  ratingCount: number;
  distance?: number | null;
  activePromo?: string | null;
  description?: string | null;
  openingHours?: OpeningHours | null;
};

interface ShopCardProps {
  shop: ShopCardData;
  variant?: "default" | "compact";
  index?: number;
  isFavorite?: boolean;
  priority?: boolean;
  showFavorite?: boolean;
  onFavoriteToggle?: (isFav: boolean) => void;
}

export function ShopCard({
  shop,
  variant = "default",
  index = 0,
  isFavorite = false,
  priority = false,
  showFavorite = true,
  onFavoriteToggle,
}: ShopCardProps) {
  const effectiveTime = shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
  const imgSrc = shop.imageUrl || getShopImage(index);
  const isOpen = shop.status === "OPEN" || shop.status === "BUSY";
  const isClosed = shop.status === "CLOSED" || shop.status === "VACATION";
  const hoursStatus = isOpen && shop.openingHours ? getShopStatus(shop.openingHours) : null;
  const closingSoonHint =
    hoursStatus && hoursStatus.status === "CLOSING_SOON" ? formatClosingHint(hoursStatus) : null;

  const prepBadgeClasses =
    effectiveTime <= 15
      ? "bg-emerald-500/90 text-white"
      : effectiveTime <= 30
        ? "bg-amber-500/90 text-white"
        : "bg-red-500/90 text-white";

  if (variant === "compact") {
    return (
      <Link
        href={`/boutique/${shop.slug}`}
        className={`flex gap-4 p-3 bg-white dark:bg-gray-800 border border-[#ece8e3] dark:border-white/[0.06] rounded-2xl shadow-sm hover:shadow-md transition-all focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 outline-none ${
          isClosed ? "opacity-60" : ""
        }`}
      >
        <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0">
          <SafeImage
            src={imgSrc}
            alt={shop.name}
            type="shop"
            fill
            sizes="96px"
            className="object-cover"
            quality={60}
          />
          {isClosed && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-xs font-bold">Fermé</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 dark:text-white truncate font-display">
              {shop.name}
            </h3>
            {showFavorite && (
              <FavoriteButton
                shopId={shop.id}
                initialFavorite={isFavorite}
                size={18}
                className="shrink-0"
                onToggle={onFavoriteToggle}
              />
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <MapPin size={11} />
            <span className="truncate">{shop.address}, {shop.city}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs">
              <Star size={11} className="text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-gray-900 dark:text-white">
                {shop.rating.toFixed(1)}
              </span>
              <span className="text-gray-500 dark:text-gray-400">({shop.ratingCount})</span>
            </div>
            {isOpen && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock size={11} />
                <span className={
                  effectiveTime <= 15
                    ? "text-emerald-600 font-semibold"
                    : effectiveTime <= 30
                      ? "text-amber-600 font-semibold"
                      : "text-red-600 font-semibold"
                }>
                  {effectiveTime} min
                </span>
              </div>
            )}
            {closingSoonHint && (
              <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                🟠 {closingSoonHint}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Default variant — grid card with full image
  return (
    <Link
      href={`/boutique/${shop.slug}`}
      className={`group bg-white dark:bg-gray-800 border border-[#ece8e3] dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 outline-none ${
        isClosed ? "opacity-60" : ""
      }`}
    >
      {/* Image */}
      <div className="relative h-36 sm:h-48 overflow-hidden">
        <SafeImage
          src={imgSrc}
          alt={shop.name}
          type="shop"
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          quality={60}
          priority={priority}
          {...(priority ? { fetchPriority: "high" as const } : {})}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {shop.activePromo && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-[#DC2626] text-white text-xs font-bold rounded-lg shadow-md">
              <Tag className="w-3 h-3" />
              {shop.activePromo}
            </span>
          )}
          <div className="flex items-center gap-2">
            {isOpen ? (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg ${prepBadgeClasses}`}>
                {effectiveTime <= 15 && (
                  <span className="w-1.5 h-1.5 bg-white dark:bg-gray-900 rounded-full animate-pulse" />
                )}
                {effectiveTime} min
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-gray-600/90 text-white text-xs font-semibold rounded-lg">
                Fermé
              </span>
            )}
            {shop.status === "BUSY" && (
              <span className="px-2 py-1 bg-amber-500/90 text-white text-xs font-semibold rounded-lg">
                Occupé
              </span>
            )}
          </div>
        </div>

        {/* Top-right: favorite + distance or city */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {showFavorite && (
            <FavoriteButton shopId={shop.id} initialFavorite={isFavorite} size={22} onToggle={onFavoriteToggle} />
          )}
          {shop.distance != null && isFinite(shop.distance) ? (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-white/90 dark:bg-black/60 backdrop-blur-sm text-gray-800 dark:text-white text-xs font-semibold rounded-lg">
              <MapPin className="w-3 h-3 text-red-600" />
              {shop.distance} km
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-white/90 dark:bg-black/60 backdrop-blur-sm text-gray-800 dark:text-white text-xs font-semibold rounded-lg">
              {shop.city}
            </span>
          )}
        </div>

        {/* Hover CTA */}
        {isOpen && (
          <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <span className="block w-full py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl shadow-lg text-center text-sm">
              Voir la boutique
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-[#DC2626] transition-colors font-display">
          {shop.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {shop.address}, {shop.city}
        </p>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-[#0a0a0a] rounded-lg">
            <Star size={12} className="text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {shop.rating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">({shop.ratingCount})</span>
          </div>
          {closingSoonHint && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
              🟠 {closingSoonHint}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
