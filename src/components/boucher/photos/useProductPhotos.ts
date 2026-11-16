// src/components/boucher/photos/useProductPhotos.ts — Photos d'un formulaire produit.
//
// État : photos-state.ts (réducteur pur). Ce hook ajoute ce qui touche au navigateur :
// - une file d'envoi, une photo à la fois, dans l'ordre d'ajout ; « Réessayer » renvoie le même
//   fichier ; une tuile retirée pendant son envoi est oubliée (la réponse est ignorée) ;
// - les URL d'objet des aperçus, révoquées dès que la tuile n'en a plus besoin (photo envoyée,
//   tuile retirée) et au démontage.
// Il ne supprime jamais de fichier du stockage : retirer une photo la retire du produit à
// l'enregistrement, rien de plus.
"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { MAX_PRODUCT_PHOTOS, TOO_MANY_PRODUCT_PHOTOS_FR } from "@/lib/images/product-image-write";
import { UPLOAD_MESSAGES_FR } from "@/lib/images/upload-contract";
import {
  addExistingOutcome,
  initialPhotosState,
  isBlocking,
  ownCount,
  photosReducer,
  primaryTileKey,
  primaryUrlOf,
  tilesOf,
  toPayload,
  type AddExistingOutcome,
  type InitialPhoto,
  type OwnTile,
  type PhotosAction,
  type PhotosPayload,
  type PhotosState,
  type PhotoTile,
} from "./photos-state";
import { uploadImage } from "./upload-transport";

const PHOTO_ALREADY_PRESENT_FR = "Cette photo est déjà dans les photos du produit.";

/** Message à montrer quand une photo choisie dans le studio n'a pas été ajoutée ; null si elle l'a été. */
export function addExistingRefusalFr(outcome: AddExistingOutcome): string | null {
  switch (outcome) {
    case "added":
      return null;
    case "full":
      return TOO_MANY_PRODUCT_PHOTOS_FR;
    case "duplicate":
      return PHOTO_ALREADY_PRESENT_FR;
  }
}

export interface ProductPhotosController {
  tiles: readonly PhotoTile[];
  /** Tuile « Principale » : celle que payload() marque isPrimary (primaryTileKey), toujours une photo envoyée. */
  primaryKey: string | null;
  primaryUrl: string | null;
  ownCount: number;
  canAddMore: boolean;
  isBlocking: boolean;
  addFiles(files: FileList | readonly File[]): void;
  /** Ajoute une photo déjà stockée (studio) ; dit si elle a été ajoutée, ou pourquoi pas. */
  addExisting(url: string, alt: string): AddExistingOutcome;
  replaceAll(images: readonly InitialPhoto[]): void;
  retry(key: string): void;
  remove(key: string): void;
  setPrimary(key: string): void;
  payload(): PhotosPayload;
}

export interface UseProductPhotosOptions {
  initialImages: readonly InitialPhoto[];
  initialImageUrl: string | null;
  purpose: "PRODUCT" | "REFERENCE";
  productName: string;
  allowCurrent: boolean;
}

function previewUrlsOf(state: PhotosState): Set<string> {
  const urls = new Set<string>();
  for (const tile of state.own)
    if (tile.kind === "uploading" || tile.kind === "failed") urls.add(tile.previewUrl);
  return urls;
}

/** Envoie, une à une, les tuiles « uploading » : la suivante part quand la précédente a répondu. */
function useUploadQueue(
  state: PhotosState,
  dispatch: (action: PhotosAction) => void,
  purpose: UseProductPhotosOptions["purpose"]
): void {
  const active = useRef<string | null>(null);
  const [settled, setSettled] = useState(0);

  useEffect(() => {
    if (active.current !== null) return;
    const next = state.own.find(
      (tile): tile is Extract<OwnTile, { kind: "uploading" }> => tile.kind === "uploading"
    );
    if (!next) return;
    const { key, file } = next;
    active.current = key;
    const finish = (action: PhotosAction) => {
      dispatch(action);
      active.current = null;
      setSettled((count) => count + 1);
    };
    void uploadImage(file, purpose, (progress) =>
      dispatch({ type: "progress", key, progress })
    ).then(
      (outcome) =>
        finish(
          outcome.ok
            ? { type: "uploaded", key, url: outcome.result.url }
            : { type: "failed", key, messageFr: outcome.messageFr }
        ),
      (error: unknown) => {
        // Défaut du code (jamais une réponse du serveur) : la tuile passe en échec pour que le
        // boucher puisse réessayer ou retirer, et l'erreur repart vers le rapport d'erreurs global.
        finish({ type: "failed", key, messageFr: UPLOAD_MESSAGES_FR.UNEXPECTED });
        throw error;
      }
    );
  }, [state.own, settled, purpose, dispatch]);
}

/**
 * Crée les URL d'aperçu (URL.createObjectURL) et les révoque dès qu'aucune tuile ne les montre
 * plus, puis toutes au démontage.
 */
function usePreviewUrls(state: PhotosState): (file: File) => string {
  const created = useRef(new Set<string>());
  useEffect(() => {
    const live = previewUrlsOf(state);
    for (const url of Array.from(created.current)) {
      if (live.has(url)) continue;
      URL.revokeObjectURL(url);
      created.current.delete(url);
    }
  }, [state]);
  useEffect(() => {
    const urls = created.current;
    return () => {
      for (const url of Array.from(urls)) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);
  return useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    created.current.add(url);
    return url;
  }, []);
}

export function useProductPhotos(opts: UseProductPhotosOptions): ProductPhotosController {
  const [state, dispatch] = useReducer(
    photosReducer,
    {
      initialImages: opts.initialImages,
      initialImageUrl: opts.initialImageUrl,
      allowCurrent: opts.allowCurrent,
    },
    initialPhotosState
  );
  useUploadQueue(state, dispatch, opts.purpose);
  const createPreviewUrl = usePreviewUrls(state);
  const { productName } = opts;

  const addFiles = useCallback(
    (files: FileList | readonly File[]) => {
      const room = MAX_PRODUCT_PHOTOS - ownCount(state);
      const accepted = Array.from(files).slice(0, Math.max(0, room));
      if (accepted.length === 0) return;
      const items = accepted.map((file) => ({ file, previewUrl: createPreviewUrl(file) }));
      dispatch({ type: "addUploading", files: items });
    },
    [state, createPreviewUrl]
  );
  const addExisting = useCallback(
    (url: string, alt: string) => {
      const outcome = addExistingOutcome(state, url);
      if (outcome === "added") dispatch({ type: "addExisting", url, alt });
      return outcome;
    },
    [state]
  );
  const replaceAll = useCallback(
    (images: readonly InitialPhoto[]) => dispatch({ type: "replaceAll", images }),
    []
  );
  const retry = useCallback((key: string) => dispatch({ type: "retry", key }), []);
  const remove = useCallback((key: string) => dispatch({ type: "remove", key }), []);
  const setPrimary = useCallback((key: string) => dispatch({ type: "setPrimary", key }), []);

  return useMemo(
    () => ({
      tiles: tilesOf(state),
      primaryKey: primaryTileKey(state),
      primaryUrl: primaryUrlOf(state),
      ownCount: ownCount(state),
      canAddMore: ownCount(state) < MAX_PRODUCT_PHOTOS,
      isBlocking: isBlocking(state),
      addFiles,
      addExisting,
      replaceAll,
      retry,
      remove,
      setPrimary,
      payload: () => toPayload(state, productName),
    }),
    [state, productName, addFiles, addExisting, replaceAll, retry, remove, setPrimary]
  );
}
