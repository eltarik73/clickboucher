"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Clock, MapPin, Flame } from "lucide-react";

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
    <Link href={`/boutique/${slug}`} className="block luxury-card group">
      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Closed overlay */}
        {!isServiceActive && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-semibold border border-white/20">
              Fermé actuellement
            </span>
          </div>
        )}

        {/* Offers badge */}
        {offersCount && offersCount > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-lg">
            <Flame size={12} />
            {offersCount} offre{offersCount > 1 ? "s" : ""}
          </div>
        )}

        {/* Rating badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-semibold">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          {rating.toFixed(1)}
        </div>

        {/* Shop name on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-white text-lg md:text-xl font-bold leading-tight text-shadow">
            {name}
          </h3>
        </div>
      </div>

      {/* Info bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-amber-600" />
            <span>{prepTimeMinutes} min</span>
          </div>
          {distance && (
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className="text-amber-600" />
              <span>{distance}</span>
            </div>
          )}
          <span className="text-muted-foreground/40">•</span>
          <span className="text-muted-foreground/70">{reviewCount} avis</span>
        </div>
        {tags && tags.length > 0 && (
          <div className="flex gap-1.5">
            {tags.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-primary/5 text-primary text-[11px] font-semibold border border-primary/10">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
