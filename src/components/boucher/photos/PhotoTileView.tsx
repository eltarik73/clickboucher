// src/components/boucher/photos/PhotoTileView.tsx — Une tuile du champ « Photos » du formulaire produit.
//
// Photo enregistrée ou « Photo actuelle » : ProductPhoto (vignette, badge « Photo indisponible »
// si elle ne se charge plus, ou si son adresse ne peut pas être affichée : lien expiré, data:,
// hôte inconnu). Envoi en cours ou en échec : l'aperçu local (URL d'objet, que l'optimiseur
// d'images ne peut pas lire, d'où un <img> simple), remplacé par une icône quand le navigateur
// ne sait pas le décoder. Chaque action est un bouton de 44 px au moins, dont le nom porte le
// numéro de la tuile.
"use client";

import { useState } from "react";
import { ImageOff, Loader2, RotateCcw, Star, X } from "lucide-react";
import { ProductPhoto } from "@/components/media/ProductPhoto";
import { isDisplayableImageUrl } from "@/lib/images/durable-url";
import type { PhotoTile } from "./photos-state";

export type PhotosAppearance = "stone" | "adaptive";

/** Palette « stone » : formulaire boucher sombre (ProductFormPage) ; « adaptive » : clair et sombre (ProductForm). */
export const PHOTO_PALETTES = {
  stone: {
    heading: "text-white",
    muted: "text-stone-400",
    button:
      "border border-stone-700 bg-stone-800 text-stone-200 hover:border-red-600 hover:text-red-400",
    tile: "border-stone-700 bg-stone-800",
    action: "text-stone-300 hover:bg-stone-700 hover:text-white",
    error: "text-red-400",
    warning: "text-amber-300",
    ringOffset: "focus-visible:ring-offset-stone-900",
    labelRingOffset: "has-[:focus-visible]:ring-offset-stone-900",
  },
  adaptive: {
    heading: "text-gray-900 dark:text-white",
    muted: "text-gray-600 dark:text-gray-400",
    button:
      "border border-gray-200 bg-white text-gray-700 hover:border-red-600 hover:text-red-700 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:text-red-400",
    tile: "border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5",
    action: "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10",
    error: "text-red-700 dark:text-red-400",
    warning: "text-amber-800 dark:text-amber-300",
    ringOffset: "focus-visible:ring-offset-background",
    labelRingOffset: "has-[:focus-visible]:ring-offset-background",
  },
} as const;

/** Anneau de focus visible (3:1) et cible tactile de 44 px. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
export const ACTION_BUTTON =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";

export interface PhotoTileViewProps {
  tile: PhotoTile;
  /** Numéro affiché de la tuile, à partir de 1. */
  number: number;
  isPrimary: boolean;
  productName: string;
  appearance: PhotosAppearance;
  onRetry(key: string): void;
  onRemove(key: string): void;
  onSetPrimary(key: string): void;
}

function UploadProgress({ progress, number }: { progress: number | null; number: number }) {
  if (progress === null) {
    return (
      <p className="flex items-center gap-1.5">
        <Loader2 aria-hidden="true" size={14} className="motion-safe:animate-spin" />
        Préparation…
      </p>
    );
  }
  const percent = Math.floor(progress * 100);
  return (
    <>
      <p className="tabular-nums">Envoi… {percent}&nbsp;%</p>
      <div
        role="progressbar"
        aria-label={`Envoi de la photo ${number}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-white/30"
      >
        <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
      </div>
    </>
  );
}

/**
 * Aperçu local d'une photo choisie. Un fichier que le navigateur ne sait pas décoder (HTML renommé
 * en .jpg, HEIC hors Safari) devient une icône : jamais l'image cassée du navigateur. onError est
 * permis ici : ce <img> n'est pas next/image et src n'est jamais réassigné.
 */
function LocalPreview({
  previewUrl,
  number,
  dimmed,
  muted,
}: {
  previewUrl: string;
  number: number;
  dimmed: boolean;
  muted: string;
}) {
  const [undecodable, setUndecodable] = useState(false);
  if (undecodable) {
    return (
      <div
        role="img"
        aria-label={`Aperçu indisponible (photo ${number})`}
        className={`flex h-full w-full items-center justify-center ${muted}`}
      >
        <ImageOff aria-hidden="true" size={32} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      src={previewUrl}
      alt={`Photo ${number} (aperçu)`}
      onError={() => setUndecodable(true)}
      className={`h-full w-full object-cover ${dimmed ? "opacity-40" : "opacity-70"}`}
    />
  );
}

/** Même badge que PhotoWithFallback quand la photo propre ne s'affiche pas. */
function UnavailableBadge() {
  return (
    <span className="pointer-events-none absolute left-1 top-1 z-10 rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
      Photo indisponible
    </span>
  );
}

export function PhotoTileView({
  tile,
  number,
  isPrimary,
  productName,
  appearance,
  onRetry,
  onRemove,
  onSetPrimary,
}: PhotoTileViewProps) {
  const palette = PHOTO_PALETTES[appearance];
  const action = `${ACTION_BUTTON} ${FOCUS_RING} ${palette.ringOffset} ${palette.action}`;

  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl border ${palette.tile}`}>
      <div className="relative aspect-square">
        {tile.kind === "uploading" || tile.kind === "failed" ? (
          <LocalPreview
            key={tile.previewUrl}
            previewUrl={tile.previewUrl}
            number={number}
            dimmed={tile.kind === "failed"}
            muted={palette.muted}
          />
        ) : (
          <>
            <ProductPhoto
              product={{ imageUrl: tile.url, name: productName }}
              alt={`Photo ${number}`}
              variant="thumb"
              fill
              sizes="200px"
              className="object-cover"
              unavailableBadge
            />
            {!isDisplayableImageUrl(tile.url) && <UnavailableBadge />}
          </>
        )}
        {isPrimary && (
          <span className="absolute right-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
            Principale
          </span>
        )}
        {tile.kind === "current" && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-xs font-semibold text-white">
            Photo actuelle
          </span>
        )}
        {tile.kind === "uploading" && (
          <div className="absolute inset-x-0 bottom-0 space-y-1 bg-black/70 px-2 py-1.5 text-xs font-semibold text-white">
            <UploadProgress progress={tile.progress} number={number} />
          </div>
        )}
      </div>
      {tile.kind === "failed" && (
        <p role="alert" className={`px-2 pt-2 text-xs font-semibold ${palette.error}`}>
          {tile.messageFr}
        </p>
      )}
      <div className="mt-auto flex items-center justify-end gap-1 p-1">
        {tile.kind === "failed" && (
          <button
            type="button"
            onClick={() => onRetry(tile.key)}
            aria-label={`Réessayer (photo ${number})`}
            className={`${action} flex-1 px-2`}
          >
            <RotateCcw aria-hidden="true" size={16} />
            Réessayer
          </button>
        )}
        {tile.kind === "saved" && !isPrimary && (
          <button
            type="button"
            onClick={() => onSetPrimary(tile.key)}
            aria-label={`Définir comme principale (photo ${number})`}
            className={action}
          >
            <Star aria-hidden="true" size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(tile.key)}
          aria-label={`Retirer (photo ${number})`}
          className={action}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </li>
  );
}
