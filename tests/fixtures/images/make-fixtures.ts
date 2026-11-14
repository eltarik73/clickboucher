// Fichiers image de test, fabriqués à la demande avec le même sharp que l'application (aucun
// fichier binaire suivi par git, sauf hevc.heic que sharp ne sait pas écrire). Utilisés par les
// tests unitaires de l'enregistrement, les tests d'intégration des routes et le parcours Playwright.
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export interface JpegOptions {
  width: number;
  height: number;
  /** Orientation EXIF (6 = photo de téléphone tenu en portrait, stockée en paysage). */
  orientation?: number;
  /** Ajoute une position GPS dans l'EXIF, comme un téléphone. */
  gps?: boolean;
  /** Bruit aléatoire (0 à 255) : grossit le fichier comme une vraie photo. */
  noise?: number;
  quality?: number;
}

/** Repère écrit dans l'EXIF des JPEG de test : sa présence prouve que l'EXIF a survécu. */
export const EXIF_MARKER = "KlikGoFixture";

/**
 * JPEG dont la moitié gauche est rouge et la moitié droite bleue (dans le sens stocké), avec un
 * dégradé vertical : le redressement EXIF se vérifie sur les dimensions comme sur les couleurs.
 */
export async function makeJpeg(options: JpegOptions): Promise<Buffer> {
  const { width, height, orientation, gps = false, noise = 0, quality = 85 } = options;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const shade = Math.round((y * 120) / height);
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const grain = noise > 0 ? Math.floor(Math.random() * noise) : 0;
      const left = x < width / 2;
      raw[offset] = Math.min(255, (left ? 220 : 20) + grain);
      raw[offset + 1] = Math.min(255, shade + grain);
      raw[offset + 2] = Math.min(255, (left ? 20 : 220) + grain);
    }
  }
  let image = sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality });
  if (orientation !== undefined) image = image.withMetadata({ orientation });
  image = image.withExifMerge({
    IFD0: { Make: EXIF_MARKER },
    ...(gps
      ? {
          IFD3: {
            GPSLatitudeRef: "N",
            GPSLatitude: "45/1 34/1 0/1",
            GPSLongitudeRef: "E",
            GPSLongitude: "5/1 55/1 0/1",
          },
        }
      : {}),
  });
  return image.toBuffer();
}

/** L'EXIF contient-il le pointeur vers un bloc GPS (balise 0x8825, dans un ordre d'octets ou l'autre) ? */
export function exifHasGps(exif: Buffer): boolean {
  return exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]));
}

/** PNG 600x400 rouge dont la moitié gauche est entièrement transparente. */
export async function makeTransparentPng(): Promise<Buffer> {
  const width = 600;
  const height = 400;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = 220;
    rgba[i * 4 + 1] = 38;
    rgba[i * 4 + 2] = 38;
    rgba[i * 4 + 3] = i % width < width / 2 ? 0 : 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** JPEG valide coupé à la moitié : en-tête correct, fin manquante (envoi interrompu). */
export async function makeTruncatedJpeg(): Promise<Buffer> {
  const whole = await makeJpeg({ width: 400, height: 300 });
  return whole.subarray(0, Math.floor(whole.length / 2));
}

/** Page HTML qu'un navigateur annoncerait comme image/jpeg : seul le contenu compte. */
export function makeHtmlDeclaredJpeg(): Buffer {
  return Buffer.from("<!doctype html><html><body><script>alert(1)</script></body></html>", "utf8");
}

/** SVG avec un script : jamais accepté, même s'il se dessine. */
export function makeSvg(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>',
    "utf8"
  );
}

/** n octets qui commencent comme un JPEG : sert aux plafonds de taille. */
export function makeBytesOfSize(n: number): Buffer {
  const bytes = Buffer.alloc(n, 0x41);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

/**
 * HEIC (HEVC) réel de 50 Ko, fabriqué par l'enquêteur « envoi-import » du diagnostic photos avec
 * les outils de macOS à partir d'une image synthétique (aucune photo personnelle).
 */
export function readHeicFixture(): Buffer {
  return readFileSync(path.join(__dirname, "hevc.heic"));
}
