"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <Link href={`/boutique/${slug}`} className="block premium-card overflow-hidden tap-scale">
      <div className="relative aspect-[16/10] bg-muted">
        <Image src={imageUrl} alt={name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        {!isServiceActive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm">Fermé</Badge>
          </div>
        )}
        {offersCount && offersCount > 0 && (
          <Badge variant="destructive" className="absolute top-3 left-3">
            {offersCount} offre{offersCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="p-3.5 space-y-2">
        <h3 className="font-display font-semibold text-base leading-tight truncate">{name}</h3>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <Star size={14} className="text-yellow-500 fill-yellow-500" strokeWidth={0} />
            <span className="font-bold">{rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviewCount})</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock size={13} />
            <span>{prepTimeMinutes} min</span>
          </div>
          {distance && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin size={13} />
              <span>{distance}</span>
            </div>
          )}
        </div>
        {tags && tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
