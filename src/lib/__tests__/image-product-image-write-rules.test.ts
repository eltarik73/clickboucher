// @vitest-environment node
// Plan d'écriture des photos d'un produit (src/lib/images/product-image-write.ts), deux règles :
// - un produit qui a des photos garde Product.imageUrl comme miroir de sa photo principale : une
//   demande qui ne fournit pas les photos ne peut ni l'effacer ni la remplacer ;
// - une nouvelle URL de notre magasin doit appartenir au périmètre du produit (inScope, fourni par
//   storeUrlsInScope) ; une photo du site /img n'a pas de propriétaire ; le droit acquis demeure.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_URL_REFUSED_FR } from "@/lib/images/durable-url";
import {
  PRIMARY_PHOTO_DECIDES_FR,
  planProductImageWrite,
  type ProductImageWriteInput,
} from "@/lib/images/product-image-write";

const STORE = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com";
const A = `${STORE}/shops/s1/product/a.webp`;
const B = `${STORE}/shops/s1/product/b.webp`;
const C = `${STORE}/shops/s1/product/c.webp`;
const CATALOGUE = "/img/products/filet-dinde.jpg";
/** Fichiers de notre magasin enregistrés pour la boutique du produit. */
const OWN = new Set([A, B, C]);

function plan(input: Omit<ProductImageWriteInput, "inScope"> & { inScope?: ReadonlySet<string> }) {
  return planProductImageWrite({ inScope: OWN, ...input });
}

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("KLIKGO_DEPLOY_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_IMAGE_BLOB_HOST", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("produit à photos : la photo principale fait foi pour imageUrl", () => {
  const withPhotos = { imageUrl: A, images: [{ url: A }, { url: B }] };

  it.each<[string, Partial<ProductImageWriteInput>]>([
    ["clearImageUrl", { clearImageUrl: true }],
    ["imageUrl null", { imageUrl: null }],
    ["une autre imageUrl", { imageUrl: CATALOGUE }],
    ["une autre photo de la boutique", { imageUrl: C }],
  ])("%s sans images → refusé, rien à écrire", (_case, request) => {
    expect(plan({ stored: withPhotos, ...request })).toEqual({
      ok: false,
      messageFr: PRIMARY_PHOTO_DECIDES_FR,
    });
    expect(PRIMARY_PHOTO_DECIDES_FR).toBe(
      "La photo principale du produit fait foi : modifiez les photos du produit."
    );
  });

  it("l'imageUrl enregistrée renvoyée telle quelle → photos et imageUrl inchangées", () => {
    expect(plan({ stored: withPhotos, imageUrl: A })).toEqual({ ok: true });
  });

  it("clearImageUrl quand imageUrl est déjà null → photos et imageUrl inchangées", () => {
    expect(plan({ stored: { imageUrl: null, images: [{ url: A }] }, clearImageUrl: true })).toEqual(
      { ok: true }
    );
  });

  it("avec images, clearImageUrl reste sans effet : le miroir suit la principale", () => {
    expect(plan({ stored: withPhotos, images: [{ url: B }], clearImageUrl: true })).toMatchObject({
      ok: true,
      imageUrl: B,
    });
  });
});

describe("périmètre : un fichier de notre magasin doit appartenir à la boutique ou à la plateforme", () => {
  const RIVAL = `${STORE}/shops/rival/product/x.webp`;

  it("un fichier hors périmètre est refusé, en photo comme en imageUrl", () => {
    expect(plan({ stored: null, images: [{ url: RIVAL }] })).toEqual({
      ok: false,
      messageFr: IMAGE_URL_REFUSED_FR,
    });
    expect(plan({ stored: { imageUrl: null, images: [] }, imageUrl: RIVAL })).toEqual({
      ok: false,
      messageFr: IMAGE_URL_REFUSED_FR,
    });
  });

  it("le même fichier est accepté quand il est dans le périmètre", () => {
    expect(
      plan({ stored: null, images: [{ url: RIVAL }], inScope: new Set([RIVAL]) })
    ).toMatchObject({
      ok: true,
      imageUrl: RIVAL,
    });
  });

  it("une photo du site (/img) n'a pas de propriétaire : acceptée sans périmètre", () => {
    expect(plan({ stored: null, images: [{ url: CATALOGUE }], inScope: new Set() })).toMatchObject({
      ok: true,
    });
  });

  it("un fichier historique déjà enregistré sur la ligne garde son droit acquis", () => {
    const legacy = `${STORE}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`;
    const stored = { imageUrl: legacy, images: [{ url: legacy }] };
    expect(plan({ stored, images: [{ url: legacy }], inScope: new Set() })).toMatchObject({
      ok: true,
      imageUrl: legacy,
    });
  });
});
