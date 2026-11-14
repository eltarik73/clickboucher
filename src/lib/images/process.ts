// src/lib/images/process.ts — Décodage et réencodage d'une image reçue. Seul fichier de src/ qui
// importe sharp (garde : tests/lib/image-writers-guard.test.ts).
//
// 1. Le format est reconnu par les premiers octets (le type annoncé par le navigateur n'est jamais
//    cru) : JPEG, PNG, WebP, GIF, AVIF. SVG, HTML ou tout autre contenu est refusé ; un HEIC
//    (iPhone) aussi, avec un message qui explique le réglage « Le plus compatible ».
// 2. sharp décode avec failOn 'error' (un fichier tronqué ou abîmé est refusé, un simple
//    avertissement de libjpeg, écrit par certains appareils Android, est toléré) et un plafond
//    de 50 mégapixels (une photo de 48 Mpx envoyée brute passe).
// 3. La photo est redressée selon l'EXIF, convertie en sRGB, posée sur fond blanc (une photo de
//    produit n'a pas de transparence), ramenée à 2048 px au plus et encodée en WebP q80 ; la
//    vignette (400 px, WebP q70) est tirée de cette photo. Aucune métadonnée n'est conservée :
//    ni EXIF, ni position GPS, ni orientation.
import sharp from "sharp";
import { ImageRejectedError } from "./errors";
import { IMAGE_MAX_SIDE, THUMB_MAX_SIDE } from "./upload-contract";

export type SniffedFormat = "jpeg" | "png" | "webp" | "gif" | "avif" | "heic";

export interface ProcessedImage {
  master: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

const MAX_INPUT_PIXELS = 50_000_000;
const MASTER_WEBP_QUALITY = 80;
const THUMB_WEBP_QUALITY = 70;
const PIXEL_LIMIT_ERROR = "pixel limit";

const AVIF_BRANDS = new Set(["avif", "avis"]);
/** Marques ISO-BMFF génériques : le contenu se lit alors dans les marques compatibles. */
const GENERIC_BRANDS = new Set(["mif1", "msf1"]);
const HEVC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.subarray(from, to));
}

/** Boîte « ftyp » d'un fichier ISO-BMFF : marque principale, puis marques compatibles. */
function isoBrandFormat(bytes: Uint8Array): SniffedFormat | null {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== "ftyp") return null;
  const major = ascii(bytes, 8, 12);
  if (AVIF_BRANDS.has(major)) return "avif";
  if (!GENERIC_BRANDS.has(major)) return "heic";
  const declaredSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const boxSize = Math.min(bytes.length, declaredSize);
  const compatible: string[] = [];
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) compatible.push(ascii(bytes, offset, offset + 4));
  if (compatible.some((brand) => HEVC_BRANDS.has(brand))) return "heic";
  return compatible.some((brand) => AVIF_BRANDS.has(brand)) ? "avif" : "heic";
}

export function sniffImageFormat(bytes: Uint8Array): SniffedFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) return "gif";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  return isoBrandFormat(bytes);
}

/** Format rendu par sharp.metadata() pour chaque format reconnu (AVIF est lu par libheif). */
const SHARP_FORMAT: Record<Exclude<SniffedFormat, "heic">, string> = {
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
  avif: "heif",
};

/** Erreur de sharp (fichier abîmé, plafond de pixels) traduite en refus de l'utilisateur. */
function decodeRejection(error: unknown): ImageRejectedError {
  if (error instanceof ImageRejectedError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ImageRejectedError(message.includes(PIXEL_LIMIT_ERROR) ? "TOO_MANY_PIXELS" : "CORRUPT");
}

async function encode(bytes: Uint8Array, expectedFormat: string): Promise<ProcessedImage> {
  const input = () =>
    sharp(bytes, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true });

  const metadata = await input().metadata();
  if (metadata.format !== expectedFormat) throw new ImageRejectedError("UNSUPPORTED_FORMAT");

  const master = await input()
    .autoOrient()
    .toColourspace("srgb")
    .flatten({ background: "#ffffff" })
    .resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: MASTER_WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const thumb = await sharp(master.data)
    .resize({ width: THUMB_MAX_SIDE, height: THUMB_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: THUMB_WEBP_QUALITY })
    .toBuffer();

  return { master: master.data, thumb, width: master.info.width, height: master.info.height };
}

/** Photo et vignette WebP prêtes à stocker ; lève ImageRejectedError (422) pour tout fichier refusé. */
export async function processImage(bytes: Uint8Array): Promise<ProcessedImage> {
  const format = sniffImageFormat(bytes);
  if (format === null) throw new ImageRejectedError("UNSUPPORTED_FORMAT");
  if (format === "heic") throw new ImageRejectedError("HEIC");
  try {
    return await encode(bytes, SHARP_FORMAT[format]);
  } catch (error) {
    throw decodeRejection(error);
  }
}
