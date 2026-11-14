// src/components/boucher/photos/ProductPhotosField.tsx — Champ « Photos » des formulaires produit.
//
// Monté par ProductFormPage (boucher), ProductForm (catalogue de référence) et, demain, l'éditeur
// produit fusionné : ils lui passent le contrôleur de useProductPhotos et n'envoient rien
// eux-mêmes. Envoi avec progression, message français et « Réessayer » en cas d'échec, tuile
// « Photo actuelle » ; tant qu'une photo est en cours d'envoi ou en échec, une ligne le dit et le
// formulaire garde « Enregistrer » désactivé (photos.isBlocking).
"use client";

import { useId, type ChangeEvent } from "react";
import { Camera, ImageIcon, Search, Sparkles } from "lucide-react";
import { MAX_PRODUCT_PHOTOS } from "@/lib/images/product-image-write";
import {
  ACTION_BUTTON,
  FOCUS_RING,
  PHOTO_PALETTES,
  PhotoTileView,
  type PhotosAppearance,
} from "./PhotoTileView";
import type { ProductPhotosController } from "./useProductPhotos";

export interface ProductPhotosFieldProps {
  photos: ProductPhotosController;
  productName: string;
  appearance: PhotosAppearance;
  onOpenSearch?: () => void;
  onOpenGenerate?: () => void;
  onOpenRetouch?: () => void;
}

export function ProductPhotosField({
  photos,
  productName,
  appearance,
  onOpenSearch,
  onOpenGenerate,
  onOpenRetouch,
}: ProductPhotosFieldProps) {
  const palette = PHOTO_PALETTES[appearance];
  const headingId = useId();
  const button = `${ACTION_BUTTON} ${FOCUS_RING} ${palette.ringOffset} ${palette.button} px-3`;

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    // Vide le champ pour qu'une même photo puisse être choisie de nouveau (après « Retirer »).
    event.currentTarget.value = "";
    if (files.length > 0) photos.addFiles(files);
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className={`text-sm font-semibold ${palette.heading}`}>
        Photos{" "}
        <span className={`font-normal ${palette.muted}`}>({MAX_PRODUCT_PHOTOS} maximum)</span>
      </h3>

      <div className="flex flex-wrap gap-2">
        <label
          className={`${ACTION_BUTTON} cursor-pointer bg-red-600 px-3 text-white hover:bg-red-700 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 ${palette.labelRingOffset}`}
        >
          <Camera aria-hidden="true" size={16} />
          Ajouter une photo
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={!photos.canAddMore}
            onChange={handleFiles}
          />
        </label>
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            disabled={!photos.canAddMore}
            className={button}
          >
            <Search aria-hidden="true" size={16} />
            Chercher
          </button>
        )}
        {onOpenGenerate && (
          <button
            type="button"
            onClick={onOpenGenerate}
            disabled={!photos.canAddMore}
            className={button}
          >
            <Sparkles aria-hidden="true" size={16} />
            Générer IA
          </button>
        )}
        {onOpenRetouch && (
          <button
            type="button"
            onClick={onOpenRetouch}
            disabled={!photos.canAddMore}
            className={button}
          >
            <ImageIcon aria-hidden="true" size={16} />
            Retoucher
          </button>
        )}
      </div>

      {photos.tiles.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.tiles.map((tile, index) => (
            <PhotoTileView
              key={tile.key}
              tile={tile}
              number={index + 1}
              isPrimary={tile.key === photos.primaryKey}
              productName={productName || "Produit"}
              appearance={appearance}
              onRetry={photos.retry}
              onRemove={photos.remove}
              onSetPrimary={photos.setPrimary}
            />
          ))}
        </ul>
      ) : (
        <p className={`text-xs ${palette.muted}`}>
          Aucune photo : le client verra une photo d&apos;illustration.
        </p>
      )}

      {/* Région annoncée présente dès le premier rendu (vide, hors du flux) pour que l'ajout du texte soit lu. */}
      <p role="status" className={`text-xs font-semibold empty:sr-only ${palette.warning}`}>
        {photos.isBlocking ? "Terminez ou retirez les photos en erreur avant d'enregistrer." : null}
      </p>
    </section>
  );
}
