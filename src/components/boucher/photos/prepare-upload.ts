// src/components/boucher/photos/prepare-upload.ts — Ce que le navigateur envoie pour une photo.
//
// Module pur : l'encodeur (canvas du navigateur, ou un faux en test) est injecté.
// Vercel refuse tout corps de plus de 4,5 Mo par un 413 text/plain, avant la route : le client
// n'envoie donc jamais plus de UPLOAD_MAX_BYTES. Table de décision (D15) :
// - photo décodée : redessinée sur fond blanc, côté le plus long ≤ IMAGE_MAX_SIDE, JPEG 0,85 ;
//   au-dessus de UPLOAD_RETRY_ABOVE_BYTES, nouvel essai à 0,7 et envoi du plus léger ;
//   toujours au-dessus de UPLOAD_MAX_BYTES : refus TOO_LARGE_AFTER_COMPRESSION ;
// - photo non décodée (ou canvas en échec) : HEIC/HEIF (type ou extension) → refus HEIC ;
//   JPEG, PNG ou WebP (type ou extension) ≤ UPLOAD_MAX_BYTES → envoyé tel quel (le serveur le
//   réencode) ; plus lourd → TOO_LARGE ; autre format → UNSUPPORTED_FORMAT.
// L'image décodée est toujours libérée (release), quelle que soit l'issue.
import {
  IMAGE_MAX_SIDE,
  UPLOAD_MAX_BYTES,
  UPLOAD_MESSAGES_FR,
  UPLOAD_RETRY_ABOVE_BYTES,
} from "@/lib/images/upload-contract";

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  release(): void;
}

export interface ImageEncoder {
  /** null quand le navigateur ne sait pas décoder le fichier. */
  decode(file: Blob): Promise<DecodedImage | null>;
  encodeJpeg(image: DecodedImage, maxSide: number, quality: number): Promise<Blob>;
}

export type PreparedUpload =
  | { ok: true; blob: Blob; filename: string }
  | { ok: false; messageFr: string };

const FIRST_QUALITY = 0.85;
const RETRY_QUALITY = 0.7;
const RAW_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RAW_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function jpegName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base || "photo"}.jpg`;
}

const refuse = (messageFr: string): PreparedUpload => ({ ok: false, messageFr });

/** Le JPEG réencodé, ou null quand le canvas échoue (mémoire, limite de surface d'iOS). */
async function compress(
  image: DecodedImage,
  encoder: ImageEncoder
): Promise<Blob | "TOO_LARGE" | null> {
  const first = await encoder.encodeJpeg(image, IMAGE_MAX_SIDE, FIRST_QUALITY).catch(() => null);
  if (first === null) return null;
  if (first.size <= UPLOAD_RETRY_ABOVE_BYTES) return first;
  const second = await encoder.encodeJpeg(image, IMAGE_MAX_SIDE, RETRY_QUALITY).catch(() => null);
  const lighter = second !== null && second.size < first.size ? second : first;
  return lighter.size <= UPLOAD_MAX_BYTES ? lighter : "TOO_LARGE";
}

/** Règles du fichier brut, quand le navigateur n'a pas pu produire un JPEG. */
function rawUpload(file: File): PreparedUpload {
  const extension = extensionOf(file.name);
  if (HEIC_TYPES.has(file.type) || HEIC_EXTENSIONS.has(extension))
    return refuse(UPLOAD_MESSAGES_FR.HEIC);
  if (!RAW_TYPES.has(file.type) && !RAW_EXTENSIONS.has(extension)) {
    return refuse(UPLOAD_MESSAGES_FR.UNSUPPORTED_FORMAT);
  }
  if (file.size > UPLOAD_MAX_BYTES) return refuse(UPLOAD_MESSAGES_FR.TOO_LARGE);
  return { ok: true, blob: file, filename: file.name || "photo" };
}

export async function prepareUpload(file: File, encoder: ImageEncoder): Promise<PreparedUpload> {
  const decoded = await encoder.decode(file);
  if (decoded === null) return rawUpload(file);
  try {
    const compressed = await compress(decoded, encoder);
    if (compressed === "TOO_LARGE") return refuse(UPLOAD_MESSAGES_FR.TOO_LARGE_AFTER_COMPRESSION);
    if (compressed === null) return rawUpload(file);
    return { ok: true, blob: compressed, filename: jpegName(file.name) };
  } finally {
    decoded.release();
  }
}
