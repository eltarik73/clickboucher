"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Clock, MapPin, Flame, ChevronRight } from "lucide-react";

const SHOP_PLACEHOLDER = "/img/shops/shop-1.jpg";

interface ShopCardProps {
  slug: string;
  name: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  prepTimeMinutes: number;
  distance?: string;
  tags?: string[];
  isServiceActive: boolean;
  offersCount?: number;
}

export function ShopCard({
  slug, name, imageUrl, rating, reviewCount,
  prepTimeMinutes, distance, tags, isServiceActive, offersCount,
}: ShopCardProps) {
  return (
    <Link href={`/boutique/${slug}`} className="block premium-card group">
      {/* Image */}
      <div className="relative aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <Image
          src={imageUrl || SHOP_PLACEHOLDER}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          quality={75}
          onError={(e) => { (e.target as HTMLImageElement).src = SHOP_PLACEHOLDER; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {!isServiceActive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-4 py-2 rounded-full bg-white/15 backdrop-blur text-white text-xs font-semibold border border-white/20">
              Fermé actuellement
            </span>
          </div>
        )}

        {offersCount && offersCount > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary text-white text-[11px] font-bold shadow-md">
            <Flame size={11} />
            {offersCount} offre{offersCount > 1 ? "s" : ""}
          </div>
        )}

        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur text-white text-[11px] font-semibold">
          <Star size={11} className="text-yellow-400 fill-yellow-400" />
          {rating.toFixed(1)}
        </div>

        {/* Name on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white text-base font-bold text-shadow">{name}</h3>
        </div>
      </div>

      {/* Meta bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[12px] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1"><Clock size={12} />{prepTimeMinutes} min</span>
          {distance && <span className="flex items-center gap-1"><MapPin size={12} />{distance}</span>}
          <span className="text-zinc-300 dark:text-zinc-600">•</span>
          <span>{reviewCount} avis</span>
        </div>
        <div className="flex items-center gap-2">
          {tags && tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">{t}</span>
          ))}
          <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Link>
  );
}
