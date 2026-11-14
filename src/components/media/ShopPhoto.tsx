// src/components/media/ShopPhoto.tsx — Photo d'une boutique.
//
// Candidates de resolveShopPhoto (src/lib/images/product-photo.ts) : la photo de la boutique si elle
// est affichable, puis une photo locale choisie par l'identifiant de la boutique (stable d'une page
// et d'un ordre de liste à l'autre), puis l'icône de PhotoWithFallback.
"use client";

import { useMemo } from "react";
import { resolveShopPhoto, type ShopPhotoSource } from "@/lib/images/product-photo";
import { PhotoWithFallback, type PhotoLayoutProps } from "./PhotoWithFallback";

export interface ShopPhotoProps extends PhotoLayoutProps {
  shop: ShopPhotoSource;
  alt: string;
  variant?: "optimized" | "thumb";
}

export function ShopPhoto({ shop, alt, variant, ...layout }: ShopPhotoProps) {
  const { id, imageUrl } = shop;
  const photo = useMemo(() => resolveShopPhoto({ id, imageUrl }), [id, imageUrl]);
  return (
    <PhotoWithFallback
      {...layout}
      candidates={photo.candidates}
      ownCandidate={photo.own}
      alt={alt}
      variant={variant}
      fallbackIcon="shop"
    />
  );
}
