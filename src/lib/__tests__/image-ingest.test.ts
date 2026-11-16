// @vitest-environment node
// Ce que produit processImage avec le vrai sharp (WebP, dimensions, redressé, sans métadonnées, sur
// fond blanc), et persistImage avec un stockage en mémoire tant qu'il n'atteint pas la base : ce qui
// est refusé sans rien laisser, et le nettoyage quand l'écriture d'un fichier échoue. La ligne du
// registre et son échec : tests/integration/images/ingest.test.ts.
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ImageRejectedError, StoreUnavailableError } from "@/lib/images/errors";
import { persistImage } from "@/lib/images/ingest";
import { processImage, sniffImageFormat } from "@/lib/images/process";
import { UPLOAD_MAX_BYTES } from "@/lib/images/upload-contract";
import {
  exifHasGps,
  makeBytesOfSize,
  makeHtmlDeclaredJpeg,
  makeJpeg,
  makeSvg,
  makeTransparentPng,
  makeTruncatedJpeg,
  readHeicFixture,
} from "../../../tests/fixtures/images/make-fixtures";
import {
  MemoryImageStore,
  type MemoryStoreOptions,
} from "../../../tests/fixtures/images/memory-store";

const OWNER = { shopId: "shopabc123", createdBy: "user_boucher_1" };
const REGISTRY = { model: "UPLOAD", prompt: "", usage: "PRODUCT" };

function harness(options: MemoryStoreOptions = {}) {
  const store = new MemoryImageStore(options);
  const persist = (bytes: Uint8Array) =>
    persistImage(
      { bytes, owner: OWNER, registry: REGISTRY, maxBytes: UPLOAD_MAX_BYTES, folder: "product" },
      store
    );
  return { store, persist };
}

describe("processImage — ce qui sera stocké", () => {
  it("photo de 4032x3024 : WebP 2048x1536 et vignette WebP 400x300", async () => {
    const image = await processImage(await makeJpeg({ width: 4032, height: 3024 }));

    expect([image.width, image.height]).toEqual([2048, 1536]);
    const master = await sharp(image.master).metadata();
    expect([master.format, master.width, master.height]).toEqual(["webp", 2048, 1536]);
    const thumb = await sharp(image.thumb).metadata();
    expect([thumb.format, thumb.width, thumb.height]).toEqual(["webp", 400, 300]);
  });

  it("photo de téléphone EXIF 6 avec GPS : debout, sans EXIF ni orientation", async () => {
    const source = await makeJpeg({ width: 1200, height: 800, orientation: 6, gps: true });
    const input = await sharp(source).metadata();
    expect(input.orientation).toBe(6);
    expect(input.exif && exifHasGps(input.exif)).toBe(true);

    const image = await processImage(source);
    expect([image.width, image.height]).toEqual([800, 1200]);
    const master = await sharp(image.master).metadata();
    expect([master.width, master.height]).toEqual([800, 1200]);
    expect(master.exif).toBeUndefined();
    expect(master.orientation).toBeUndefined();
    expect((await sharp(image.thumb).metadata()).exif).toBeUndefined();
  });

  it("PNG transparent : sans canal alpha, la zone transparente devient blanche", async () => {
    const bytes = (await processImage(await makeTransparentPng())).master;
    expect((await sharp(bytes).metadata()).hasAlpha).toBe(false);
    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return [data[offset], data[offset + 1], data[offset + 2]];
    };
    expect(pixel(10, 200)).toEqual([255, 255, 255]);
    expect(pixel(590, 200)[0]).toBeGreaterThan(180);
  });
});

describe("persistImage — refus (422), rien n'est écrit", () => {
  const cases: Array<[string, () => Promise<Uint8Array> | Uint8Array, string]> = [
    ["une page HTML annoncée image/jpeg", makeHtmlDeclaredJpeg, "UNSUPPORTED_FORMAT"],
    ["un SVG", makeSvg, "UNSUPPORTED_FORMAT"],
    ["un JPEG tronqué", makeTruncatedJpeg, "CORRUPT"],
    ["un HEIC (HEVC)", readHeicFixture, "HEIC"],
    ["un corps de 4,2 Mio", () => makeBytesOfSize(Math.round(4.2 * 1024 * 1024)), "TOO_LARGE"],
  ];

  it.each(cases)("%s", async (_label, make, reason) => {
    const { store, persist } = harness();
    const error = await persist(await make()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ImageRejectedError);
    expect(error).toMatchObject({ reason });
    expect(store.puts).toEqual([]);
  });

  it("le refus HEIC explique le réglage iPhone « Le plus compatible »", async () => {
    const { persist } = harness();
    const error = await persist(readHeicFixture()).catch((caught: unknown) => caught);
    expect((error as ImageRejectedError).messageFr).toContain("« Le plus compatible »");
  });

  it("au-delà de 50 mégapixels : TOO_MANY_PIXELS", async () => {
    const { store, persist } = harness();
    const huge = await sharp({
      create: { width: 8000, height: 7000, channels: 3, background: "#808080" },
    })
      .jpeg({ quality: 30 })
      .toBuffer();
    await expect(persist(huge)).rejects.toMatchObject({ reason: "TOO_MANY_PIXELS" });
    expect(store.puts).toEqual([]);
  });
});

describe("persistImage — échec d'écriture d'un fichier : les fichiers écrits sont effacés", () => {
  it("le stockage rend une URL non durable : StoreUnavailableError, les deux fichiers effacés", async () => {
    const { store, persist } = harness({ urlBase: "https://images.example.com" });
    const error = await persist(await makeJpeg({ width: 800, height: 600 })).catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(StoreUnavailableError);
    expect(store.dels).toHaveLength(2);
    expect(store.files.size).toBe(0);
  });

  it("l'écriture de la vignette échoue : la photo est effacée, StoreUnavailableError", async () => {
    const { store, persist } = harness({ failPutAt: 1 });
    await expect(persist(await makeJpeg({ width: 800, height: 600 }))).rejects.toBeInstanceOf(
      StoreUnavailableError
    );
    expect(store.dels).toEqual([store.puts[0].url]);
    expect(store.files.size).toBe(0);
  });

  it("l'écriture de la photo échoue : StoreUnavailableError, rien à effacer", async () => {
    const { store, persist } = harness({ failPutAt: 0 });
    await expect(persist(await makeJpeg({ width: 800, height: 600 }))).rejects.toBeInstanceOf(
      StoreUnavailableError
    );
    expect(store.dels).toEqual([]);
  });
});

describe("sniffImageFormat — le contenu, jamais le type annoncé", () => {
  const ftyp = (major: string, ...compatible: string[]) => {
    const brands = [major, "\0\0\0\0", ...compatible].join("");
    const size = 8 + brands.length;
    return Uint8Array.from([0, 0, 0, size, ...Buffer.from(`ftyp${brands}`, "latin1")]);
  };

  it.each<[string, Uint8Array, string | null]>([
    ["AVIF", ftyp("avif", "mif1"), "avif"],
    ["AVIF séquence", ftyp("avis"), "avif"],
    ["mif1 qui annonce AVIF", ftyp("mif1", "avif"), "avif"],
    ["mif1 qui annonce HEIC", ftyp("mif1", "heic", "avif"), "heic"],
    ["HEIC", ftyp("heic", "mif1"), "heic"],
    ["autre marque ISO-BMFF", ftyp("isom"), "heic"],
    ["GIF89a", Uint8Array.from(Buffer.from("GIF89a....", "latin1")), "gif"],
    ["WebP", Uint8Array.from(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")), "webp"],
    ["RIFF non WebP", Uint8Array.from(Buffer.from("RIFF\0\0\0\0AVI LIST", "latin1")), null],
    ["vide", new Uint8Array(0), null],
  ])("%s", (_label, bytes, expected) => {
    expect(sniffImageFormat(bytes)).toBe(expected);
  });
});
