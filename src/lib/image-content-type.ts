// src/lib/image-content-type.ts — Liste blanche des types MIME image servis ou stockés par l'app.
//
// Pourquoi : un Content-Type amont renvoyé tel quel (proxy same-origin) ou stocké
// tel quel dans le Blob public (import, retouche) permettrait de faire servir du
// HTML ou du SVG scripté depuis nos propres origines. `image/svg+xml` est exclu
// volontairement : un SVG peut embarquer du script.

export const SAFE_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type SafeImageContentType = (typeof SAFE_IMAGE_CONTENT_TYPES)[number];

const EXTENSIONS: Record<SafeImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function isSafeImageContentType(value: string): value is SafeImageContentType {
  return (SAFE_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * Normalise un Content-Type (type média avant `;`, sans espaces, en minuscules)
 * et le retourne s'il est dans la liste blanche, sinon `null`.
 * Un en-tête absent ou vide retourne `null` : pas de valeur par défaut.
 */
export function parseSafeImageContentType(
  header: string | null | undefined
): SafeImageContentType | null {
  if (!header) return null;
  const mediaType = header.split(";")[0].trim().toLowerCase();
  return isSafeImageContentType(mediaType) ? mediaType : null;
}

/** Extension de fichier (sans point) associée à un type de la liste blanche. */
export function extensionForImageContentType(type: SafeImageContentType): string {
  return EXTENSIONS[type];
}
