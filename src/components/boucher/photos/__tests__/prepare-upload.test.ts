// @vitest-environment node
// Table de décision de l'envoi côté navigateur (A8, D15), avec un encodeur factice : le client
// n'envoie jamais plus de 4 Mio (Vercel répond 413 en text/plain au-delà de 4,5 Mo, avant la
// route) et refuse en français ce qu'il ne peut ni réduire ni envoyer tel quel.
import { describe, expect, it } from "vitest";
import {
  prepareUpload,
  type DecodedImage,
  type ImageEncoder,
  type PreparedUpload,
} from "@/components/boucher/photos/prepare-upload";
import {
  IMAGE_MAX_SIDE,
  UPLOAD_MAX_BYTES,
  UPLOAD_MESSAGES_FR,
  UPLOAD_RETRY_ABOVE_BYTES,
} from "@/lib/images/upload-contract";

const MIB = 1024 * 1024;

const contents = new Map<number, Blob>();

/** Contenu de la taille voulue, alloué une fois par taille (la table complète en crée des milliers). */
function bytesOf(size: number): Blob {
  const cached = contents.get(size);
  if (cached) return cached;
  const blob = new Blob([new Uint8Array(size)]);
  contents.set(size, blob);
  return blob;
}

function fileOf(size: number, name: string, type: string): File {
  return new File([bytesOf(size)], name, { type });
}

interface FakeEncoder extends ImageEncoder {
  readonly encodes: { maxSide: number; quality: number }[];
  readonly released: number;
  readonly decoded: number;
}

/** Encodeur factice : decode() réussit ou non ; encodeJpeg() rend un JPEG de la taille donnée par qualité. */
function fakeEncoder(opts: {
  decodes: boolean;
  sizeAt?: (quality: number) => number;
  encodeFails?: boolean;
}): FakeEncoder {
  const encodes: { maxSide: number; quality: number }[] = [];
  let released = 0;
  let decoded = 0;
  return {
    encodes,
    get released() {
      return released;
    },
    get decoded() {
      return decoded;
    },
    async decode(): Promise<DecodedImage | null> {
      if (!opts.decodes) return null;
      decoded += 1;
      return { width: 4032, height: 3024, release: () => (released += 1) };
    },
    async encodeJpeg(_image, maxSide, quality): Promise<Blob> {
      encodes.push({ maxSide, quality });
      if (opts.encodeFails) throw new Error("canvas indisponible");
      return new Blob([bytesOf(opts.sizeAt ? opts.sizeAt(quality) : MIB)], { type: "image/jpeg" });
    },
  };
}

function sent(result: PreparedUpload): Blob {
  if (!result.ok) throw new Error(`refusé : ${result.messageFr}`);
  return result.blob;
}

describe("photo décodée par le navigateur", () => {
  it("is re-encoded as a JPEG at 0.85, longest side at most 2048 px", async () => {
    const encoder = fakeEncoder({ decodes: true, sizeAt: () => 900 * 1024 });
    const result = await prepareUpload(fileOf(6 * MIB, "IMG_0001.JPG", "image/jpeg"), encoder);
    const blob = sent(result);
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBeLessThanOrEqual(UPLOAD_MAX_BYTES);
    expect(encoder.encodes).toEqual([{ maxSide: IMAGE_MAX_SIDE, quality: 0.85 }]);
    expect(result.ok && result.filename).toBe("IMG_0001.jpg");
    expect(encoder.released).toBe(1);
  });

  it("a transparent PNG goes through the same canvas path (white fill) and is named .jpg", async () => {
    const encoder = fakeEncoder({ decodes: true });
    const result = await prepareUpload(fileOf(2 * MIB, "logo.png", "image/png"), encoder);
    expect(result.ok && result.filename).toBe("logo.jpg");
    expect(encoder.encodes).toHaveLength(1);
  });

  it("above 3.5 MiB at 0.85, encodes again at 0.7 and sends the smaller result", async () => {
    const encoder = fakeEncoder({
      decodes: true,
      sizeAt: (q) => (q === 0.85 ? 3.8 * MIB : 2.9 * MIB),
    });
    const blob = sent(await prepareUpload(fileOf(9 * MIB, "a.jpg", "image/jpeg"), encoder));
    expect(encoder.encodes.map((e) => e.quality)).toEqual([0.85, 0.7]);
    expect(blob.size).toBe(Math.floor(2.9 * MIB));
    expect(encoder.released).toBe(1);
  });

  it("exactly 3.5 MiB at 0.85 is sent without a second encode", async () => {
    const encoder = fakeEncoder({ decodes: true, sizeAt: () => UPLOAD_RETRY_ABOVE_BYTES });
    sent(await prepareUpload(fileOf(9 * MIB, "a.jpg", "image/jpeg"), encoder));
    expect(encoder.encodes).toHaveLength(1);
  });

  it("still above 4 MiB after the retry: refused in French, nothing to send", async () => {
    const encoder = fakeEncoder({ decodes: true, sizeAt: () => UPLOAD_MAX_BYTES + 1 });
    const result = await prepareUpload(fileOf(20 * MIB, "pano.jpg", "image/jpeg"), encoder);
    expect(result).toEqual({
      ok: false,
      messageFr: UPLOAD_MESSAGES_FR.TOO_LARGE_AFTER_COMPRESSION,
    });
    expect(encoder.released).toBe(1);
  });

  it("a failing canvas falls back to the raw-file rules, and the decoded image is released", async () => {
    const small = fakeEncoder({ decodes: true, encodeFails: true });
    const file = fileOf(3 * MIB, "a.jpg", "image/jpeg");
    expect(sent(await prepareUpload(file, small))).toBe(file);
    expect(small.released).toBe(1);
    const large = fakeEncoder({ decodes: true, encodeFails: true });
    expect(await prepareUpload(fileOf(5 * MIB, "a.jpg", "image/jpeg"), large)).toEqual({
      ok: false,
      messageFr: UPLOAD_MESSAGES_FR.TOO_LARGE,
    });
    expect(large.released).toBe(1);
  });
});

describe("photo que le navigateur ne décode pas", () => {
  it("a 3 MiB image/jpeg is sent as is (the server re-encodes it)", async () => {
    const file = fileOf(3 * MIB, "photo.jpg", "image/jpeg");
    const result = await prepareUpload(file, fakeEncoder({ decodes: false }));
    expect(sent(result)).toBe(file);
    expect(result.ok && result.filename).toBe("photo.jpg");
  });

  it("png and webp too, recognised by type or by extension", async () => {
    for (const [name, type] of [
      ["a.png", "image/png"],
      ["a.webp", "image/webp"],
      ["a.WEBP", ""],
      ["a.jpeg", ""],
    ]) {
      const file = fileOf(MIB, name, type);
      expect(sent(await prepareUpload(file, fakeEncoder({ decodes: false })))).toBe(file);
    }
  });

  it("HEIC is refused with the iPhone explanation, by type or by name (any case)", async () => {
    for (const file of [
      fileOf(2 * MIB, "IMG_1.heic", "image/heic"),
      fileOf(2 * MIB, "IMG_1.HEIC", ""),
      fileOf(2 * MIB, "IMG_2.heif", "image/heif"),
      fileOf(2 * MIB, "IMG_3.Heif", "application/octet-stream"),
    ]) {
      expect(await prepareUpload(file, fakeEncoder({ decodes: false }))).toEqual({
        ok: false,
        messageFr: UPLOAD_MESSAGES_FR.HEIC,
      });
    }
  });

  it("a 5 MiB jpeg is refused as too large", async () => {
    expect(
      await prepareUpload(fileOf(5 * MIB, "a.jpg", "image/jpeg"), fakeEncoder({ decodes: false }))
    ).toEqual({
      ok: false,
      messageFr: UPLOAD_MESSAGES_FR.TOO_LARGE,
    });
  });

  it("image/tiff (or any other type) is refused as unsupported", async () => {
    for (const file of [
      fileOf(MIB, "scan.tiff", "image/tiff"),
      fileOf(MIB, "notes.txt", "text/plain"),
      fileOf(MIB, "x", ""),
    ]) {
      expect(await prepareUpload(file, fakeEncoder({ decodes: false }))).toEqual({
        ok: false,
        messageFr: UPLOAD_MESSAGES_FR.UNSUPPORTED_FORMAT,
      });
    }
  });
});

describe("sur toute la table", () => {
  it("no returned blob ever exceeds UPLOAD_MAX_BYTES, and every decoded image is released", async () => {
    const sizes = [0.5 * MIB, 3.5 * MIB, 3.6 * MIB, 4 * MIB, 4 * MIB + 1, 12 * MIB];
    const types: [string, string][] = [
      ["a.jpg", "image/jpeg"],
      ["a.png", "image/png"],
      ["a.webp", "image/webp"],
      ["a.heic", "image/heic"],
      ["a.gif", "image/gif"],
      ["a.tiff", "image/tiff"],
    ];
    for (const decodes of [true, false]) {
      for (const encodeFails of [false, true]) {
        for (const fileSize of sizes) {
          for (const firstSize of sizes) {
            for (const secondSize of sizes) {
              for (const [name, type] of types) {
                const encoder = fakeEncoder({
                  decodes,
                  encodeFails,
                  sizeAt: (q) => Math.floor(q === 0.85 ? firstSize : secondSize),
                });
                const result = await prepareUpload(
                  fileOf(Math.floor(fileSize), name, type),
                  encoder
                );
                if (result.ok) expect(result.blob.size).toBeLessThanOrEqual(UPLOAD_MAX_BYTES);
                else expect(result.messageFr).not.toMatch(/undefined|Error|JSON/);
                expect(encoder.released).toBe(encoder.decoded);
              }
            }
          }
        }
      }
    }
  });
});
