// src/components/media/PhotoWithFallback.tsx — Une photo qui ne casse jamais.
//
// Affiche la première candidate ; si elle échoue, passe à la suivante, une seule fois par
// candidate ; après la dernière, une icône en ligne (aucune requête). L'indice de la candidate est
// un état React, remis à 0 quand la liste change (nouveau produit, nouvelle boutique).
//
// Deux interdits, cause de la boucle de requêtes de l'ancienne ProductCard :
// - ne jamais passer onError à next/image : quand il existe, next/image réassigne img.src au
//   montage (next/dist/client/image-component.js, rappel du ref), soit une requête de plus par
//   candidate en échec ;
// - ne jamais assigner src soi-même : chaque candidate est un <img> distinct (key = candidate).
// L'échec est détecté par un écouteur natif « error » posé sur l'<img>, et, juste après le
// montage, par img.complete && naturalWidth === 0 : une erreur survenue avant l'hydratation
// n'a déclenché aucun écouteur.
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, Store } from "lucide-react";
import { classifyImageUrl } from "@/lib/images/durable-url";
import type { ResolvedPhoto } from "@/lib/images/product-photo";
import { thumbnailOf } from "@/lib/images/thumbnail";

export interface PhotoLayoutProps {
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  className?: string;
}

export interface PhotoWithFallbackProps extends PhotoLayoutProps {
  /** Candidates in the order they are tried (the last one a local photo of the site), and the own photo. */
  photo: ResolvedPhoto;
  alt: string;
  /** 'thumb' : vignette -t quand la photo en a une (servie telle quelle), sinon la photo optimisée. */
  variant?: "optimized" | "thumb";
  fallbackIcon: "product" | "shop";
  /**
   * Badge « Photo indisponible » quand la photo propre ne peut pas être affichée ou a échoué
   * (écrans du boucher). Le badge est placé en absolu : le parent doit être positionné, comme pour fill.
   */
  unavailableBadge?: boolean;
}

interface DisplaySource {
  src: string;
  unoptimized: boolean;
}

/** Fichier demandé pour une candidate : la vignette en variante 'thumb', jamais l'optimiseur pour nos fichiers WebP. */
function displaySource(candidate: string, variant: "optimized" | "thumb"): DisplaySource {
  const thumbnail = variant === "thumb" ? thumbnailOf(candidate) : null;
  const src = thumbnail ?? candidate;
  return { src, unoptimized: thumbnail !== null || classifyImageUrl(src) === "LOCAL_STORE" };
}

const ICONS = { product: ImageOff, shop: Store } as const;

export function PhotoWithFallback({
  photo,
  alt,
  variant = "optimized",
  fallbackIcon,
  unavailableBadge = false,
  fill,
  width,
  height,
  sizes,
  quality,
  priority,
  className,
}: PhotoWithFallbackProps) {
  const { candidates } = photo;
  const signature = candidates.join("\n");
  const [position, setPosition] = useState({ signature, index: 0 });
  if (position.signature !== signature) {
    setPosition({ signature, index: 0 });
  }
  const index = position.signature === signature ? position.index : 0;
  const candidate = index < candidates.length ? candidates[index] : null;
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = imageRef.current;
    if (candidate === null || img === null) return;
    const failedIndex = index;
    const advance = () =>
      setPosition((current) =>
        current.signature === signature && current.index === failedIndex
          ? { signature, index: failedIndex + 1 }
          : current
      );
    img.addEventListener("error", advance);
    if (img.complete && img.naturalWidth === 0) advance();
    return () => img.removeEventListener("error", advance);
  }, [signature, index, candidate]);

  const ownIndex = photo.own === null ? -1 : candidates.indexOf(photo.own);
  const ownUnavailable = photo.ownRejected || (ownIndex !== -1 && index > ownIndex);
  const badge =
    unavailableBadge && ownUnavailable ? (
      <span className="pointer-events-none absolute left-1 top-1 z-10 rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
        Photo indisponible
      </span>
    ) : null;

  if (candidate === null) {
    const Icon = ICONS[fallbackIcon];
    const boxClasses = [
      fill ? "absolute inset-0" : null,
      "flex items-center justify-center bg-stone-100 dark:bg-white/5",
      className ?? null,
    ];
    return (
      <>
        <div
          role="img"
          aria-label={alt}
          className={boxClasses.filter((value) => value !== null).join(" ")}
          style={fill ? undefined : { width, height }}
        >
          <Icon
            aria-hidden="true"
            strokeWidth={1.5}
            className="h-1/2 max-h-12 w-1/2 max-w-12 text-stone-400 dark:text-stone-500"
          />
        </div>
        {badge}
      </>
    );
  }

  const { src, unoptimized } = displaySource(candidate, variant);
  return (
    <>
      <Image
        key={candidate}
        ref={imageRef}
        src={src}
        alt={alt}
        unoptimized={unoptimized}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={sizes}
        quality={quality}
        priority={priority}
        className={className}
      />
      {badge}
    </>
  );
}
