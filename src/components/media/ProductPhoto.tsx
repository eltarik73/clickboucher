// src/components/media/ProductPhoto.tsx — Photo d'un produit, partout où un produit s'affiche.
//
// Les candidates viennent de resolveProductPhoto (src/lib/images/product-photo.ts, seule autorité) :
// photo principale, Product.imageUrl, puis une photo locale du site ; jamais une URL qui expire,
// data:, blob: ou un hôte inconnu. PhotoWithFallback passe de l'une à l'autre sans boucle.
"use client";

import { useMemo } from "react";
import { resolveProductPhoto, type ProductPhotoSource } from "@/lib/images/product-photo";
import { PhotoWithFallback, type PhotoLayoutProps } from "./PhotoWithFallback";

export interface ProductPhotoProps extends PhotoLayoutProps {
  product: ProductPhotoSource;
  /** Texte alternatif ; par défaut le nom du produit. */
  alt?: string;
  variant?: "optimized" | "thumb";
  unavailableBadge?: boolean;
}

export function ProductPhoto({
  product,
  alt,
  variant,
  unavailableBadge,
  ...layout
}: ProductPhotoProps) {
  const { images, imageUrl, name, category } = product;
  const photo = useMemo(
    () => resolveProductPhoto({ images, imageUrl, name, category }),
    [images, imageUrl, name, category]
  );
  return (
    <PhotoWithFallback
      {...layout}
      photo={photo}
      alt={alt ?? name}
      variant={variant}
      unavailableBadge={unavailableBadge}
      fallbackIcon="product"
    />
  );
}
