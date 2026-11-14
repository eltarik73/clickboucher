// src/components/boucher/photos/browser-encoder.ts — Décodage et réencodage d'une photo dans le navigateur.
//
// decode : createImageBitmap avec l'orientation EXIF appliquée ; s'il manque ou échoue (HEIC sur
// Chrome, vieux WebView), un <img> décodé depuis une URL d'objet, révoquée à la libération.
// encodeJpeg : canvas dont le côté le plus long vaut min(original, maxSide), jamais un canvas à
// la taille de la photo (iOS refuse un canvas de plus de 16,7 Mpx environ), rempli de blanc avant
// de dessiner (un PNG transparent ne devient pas noir), exporté en JPEG.
"use client";

import type { DecodedImage, ImageEncoder } from "./prepare-upload";

interface BrowserDecodedImage extends DecodedImage {
  readonly source: CanvasImageSource;
}

function isBrowserDecoded(image: DecodedImage): image is BrowserDecodedImage {
  return "source" in image;
}

async function decodeBitmap(file: Blob): Promise<BrowserDecodedImage | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(
    () => null
  );
  if (bitmap === null) return null;
  return {
    width: bitmap.width,
    height: bitmap.height,
    source: bitmap,
    release: () => bitmap.close(),
  };
}

async function decodeImageElement(file: Blob): Promise<BrowserDecodedImage | null> {
  const url = URL.createObjectURL(file);
  const img = document.createElement("img");
  img.decoding = "async";
  img.src = url;
  const decoded = await img.decode().then(
    () => img.naturalWidth > 0 && img.naturalHeight > 0,
    () => false
  );
  if (!decoded) {
    URL.revokeObjectURL(url);
    return null;
  }
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    source: img,
    release: () => URL.revokeObjectURL(url),
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Rend la mémoire du canvas tout de suite (Safari la garde sinon jusqu'au ramasse-miettes).
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error("Le navigateur n'a pas pu produire le JPEG."));
      },
      "image/jpeg",
      quality
    );
  });
}

export const browserEncoder: ImageEncoder = {
  async decode(file) {
    return (await decodeBitmap(file)) ?? decodeImageElement(file);
  },

  async encodeJpeg(image, maxSide, quality) {
    if (!isBrowserDecoded(image)) throw new TypeError("Image décodée par un autre encodeur.");
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D indisponible.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    return canvasToJpeg(canvas, quality);
  },
};
