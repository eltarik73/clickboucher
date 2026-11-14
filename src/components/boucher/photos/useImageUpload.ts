// src/components/boucher/photos/useImageUpload.ts — Préparer puis envoyer une photo.
//
// upload(file, onProgress) : onProgress(null) pendant la préparation (décodage, réduction), puis
// la part envoyée (0 à 1). Ce que le navigateur envoie suit prepareUpload ; la réponse suit
// interpretUploadResponse. La promesse rend toujours une issue affichable.
"use client";

import { useCallback, useMemo } from "react";
import type { UploadPurpose } from "@/lib/images/upload-contract";
import { browserEncoder } from "./browser-encoder";
import { prepareUpload } from "./prepare-upload";
import { sendUpload, type UploadOutcome } from "./upload-transport";

export function useImageUpload(purpose: UploadPurpose): {
  upload(file: File, onProgress: (ratio: number | null) => void): Promise<UploadOutcome>;
} {
  const upload = useCallback(
    async (file: File, onProgress: (ratio: number | null) => void): Promise<UploadOutcome> => {
      onProgress(null);
      const prepared = await prepareUpload(file, browserEncoder);
      if (!prepared.ok) return prepared;
      return sendUpload(prepared.blob, prepared.filename, purpose, onProgress);
    },
    [purpose]
  );
  return useMemo(() => ({ upload }), [upload]);
}
