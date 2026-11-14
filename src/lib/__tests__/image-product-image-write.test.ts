// @vitest-environment node
// Plan d'écriture des photos d'un produit (src/lib/images/product-image-write.ts) : chaque règle
// de la décision D5 (refus, normalisation, miroir Product.imageUrl). Périmètre des fichiers de notre
// magasin et « la photo principale fait foi » : image-product-image-write-rules.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_URL_REFUSED_FR } from "@/lib/images/durable-url";
import {
  CLEAR_AND_SET_IMAGE_REFUSED_FR,
  MAX_PRODUCT_PHOTOS,
  TOO_MANY_PRODUCT_PHOTOS_FR,
  planProductImageWrite,
  type ProductImageWriteInput,
} from "@/lib/images/product-image-write";

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/s1/product";
const A = `${BLOB}/a.webp`;
const B = `${BLOB}/b.webp`;
const C = `${BLOB}/c.webp`;
const UNSPLASH = "https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75";
const REPLICATE = "https://pbxt.replicate.delivery/abc/out-0.webp";
const CATALOGUE = "/img/products/filet-dinde.jpg";
const PHOTOS = Array.from({ length: 6 }, (_, i) => `${BLOB}/p${i}.webp`);
/** Fichiers de notre magasin enregistrés pour la boutique du produit (storeUrlsInScope). */
const OWN = new Set([A, B, C, ...PHOTOS]);

/** planProductImageWrite, avec par défaut les fichiers de la boutique dans le périmètre. */
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

describe("miroir : images fournies et non vides", () => {
  it("création avec [A, B(principale)] → imageUrl = B", () => {
    const result = plan({ stored: null, images: [{ url: A }, { url: B, isPrimary: true }] });
    expect(result).toEqual({
      ok: true,
      images: [
        { url: A, alt: null, order: 0, isPrimary: false },
        { url: B, alt: null, order: 1, isPrimary: true },
      ],
      imageUrl: B,
    });
  });

  it("ajouter une photo propre à un produit qui n'a qu'une imageUrl → le miroir devient cette photo", () => {
    const result = plan({ stored: { imageUrl: UNSPLASH, images: [] }, images: [{ url: A }] });
    expect(result).toEqual({ ok: true, images: [{ url: A, alt: null, order: 0, isPrimary: true }], imageUrl: A });
  });

  it("clearImageUrl est sans effet quand des images sont fournies", () => {
    const result = plan({ stored: { imageUrl: UNSPLASH, images: [] }, images: [{ url: A }], clearImageUrl: true });
    expect(result).toMatchObject({ ok: true, imageUrl: A });
  });

  it("une photo du catalogue /img est acceptée et reflétée", () => {
    const result = plan({ stored: null, images: [{ url: CATALOGUE, alt: "Filet" }] });
    expect(result).toEqual({
      ok: true,
      images: [{ url: CATALOGUE, alt: "Filet", order: 0, isPrimary: true }],
      imageUrl: CATALOGUE,
    });
  });
});

describe("miroir : images fournies et vides", () => {
  it("un produit qui n'a qu'une imageUrl la garde (clé absente)", () => {
    const result = plan({ stored: { imageUrl: UNSPLASH, images: [] }, images: [] });
    expect(result).toEqual({ ok: true, images: [] });
    expect(result).not.toHaveProperty("imageUrl");
  });

  it("clearImageUrl → null", () => {
    expect(plan({ stored: { imageUrl: UNSPLASH, images: [] }, images: [], clearImageUrl: true })).toEqual({
      ok: true,
      images: [],
      imageUrl: null,
    });
  });

  it("retirer l'image reflétée → null", () => {
    const result = plan({ stored: { imageUrl: B, images: [{ url: A }, { url: B }] }, images: [] });
    expect(result).toEqual({ ok: true, images: [], imageUrl: null });
  });

  it("imageUrl différente des images retirées → inchangée", () => {
    const result = plan({ stored: { imageUrl: CATALOGUE, images: [{ url: A }] }, images: [] });
    expect(result).toEqual({ ok: true, images: [] });
  });

  it("à la création : l'imageUrl fournie, sinon null", () => {
    expect(plan({ stored: null, images: [], imageUrl: CATALOGUE })).toEqual({
      ok: true,
      images: [],
      imageUrl: CATALOGUE,
    });
    expect(plan({ stored: null, images: [] })).toEqual({ ok: true, images: [], imageUrl: null });
  });
});

describe("miroir : images non fournies", () => {
  it("rien de fourni → rien à écrire", () => {
    expect(plan({ stored: { imageUrl: UNSPLASH, images: [] } })).toEqual({ ok: true });
  });

  it("produit à imageUrl seule : clearImageUrl → null", () => {
    expect(plan({ stored: { imageUrl: CATALOGUE, images: [] }, clearImageUrl: true })).toEqual({
      ok: true,
      imageUrl: null,
    });
  });

  it("l'imageUrl fournie est écrite, null compris", () => {
    expect(plan({ stored: { imageUrl: null, images: [] }, imageUrl: CATALOGUE })).toEqual({
      ok: true,
      imageUrl: CATALOGUE,
    });
    expect(plan({ stored: { imageUrl: CATALOGUE, images: [] }, imageUrl: null })).toEqual({
      ok: true,
      imageUrl: null,
    });
  });
});

describe("règle d'écriture et droit acquis", () => {
  it("une valeur Unsplash inchangée est acceptée en modification", () => {
    expect(plan({ stored: { imageUrl: UNSPLASH, images: [] }, imageUrl: UNSPLASH })).toEqual({
      ok: true,
      imageUrl: UNSPLASH,
    });
    expect(plan({ stored: { imageUrl: null, images: [{ url: UNSPLASH }] }, images: [{ url: UNSPLASH }] })).toMatchObject({
      ok: true,
      imageUrl: UNSPLASH,
    });
  });

  it("la même valeur Unsplash est refusée à la création", () => {
    expect(plan({ stored: null, imageUrl: UNSPLASH })).toEqual({ ok: false, messageFr: IMAGE_URL_REFUSED_FR });
    expect(plan({ stored: null, images: [{ url: UNSPLASH }] })).toEqual({
      ok: false,
      messageFr: IMAGE_URL_REFUSED_FR,
    });
  });

  it("une nouvelle valeur Unsplash est refusée en modification", () => {
    const result = plan({
      stored: { imageUrl: UNSPLASH, images: [] },
      images: [{ url: "https://images.unsplash.com/photo-2" }],
    });
    expect(result).toEqual({ ok: false, messageFr: IMAGE_URL_REFUSED_FR });
  });

  it("une URL replicate.delivery est refusée, même parmi des photos valides", () => {
    expect(plan({ stored: null, images: [{ url: A }, { url: REPLICATE }] })).toEqual({
      ok: false,
      messageFr: IMAGE_URL_REFUSED_FR,
    });
    expect(plan({ stored: { imageUrl: null, images: [] }, imageUrl: REPLICATE })).toEqual({
      ok: false,
      messageFr: IMAGE_URL_REFUSED_FR,
    });
  });

  it("l'imageUrl fournie est contrôlée même quand le miroir l'emporte", () => {
    expect(plan({ stored: null, images: [{ url: A }], imageUrl: REPLICATE })).toEqual({
      ok: false,
      messageFr: IMAGE_URL_REFUSED_FR,
    });
  });
});

describe("refus", () => {
  it(`${MAX_PRODUCT_PHOTOS + 1} images distinctes sont refusées`, () => {
    const six = PHOTOS.map((url) => ({ url }));
    expect(plan({ stored: null, images: six })).toEqual({ ok: false, messageFr: TOO_MANY_PRODUCT_PHOTOS_FR });
    expect(TOO_MANY_PRODUCT_PHOTOS_FR).toBe("5 photos maximum par produit.");
  });

  it("le plafond se compte après dédoublonnage", () => {
    const five = PHOTOS.slice(0, 5).map((url) => ({ url }));
    const result = plan({ stored: null, images: [...five, { url: PHOTOS[0] }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.images).toHaveLength(5);
  });

  it("clearImageUrl avec imageUrl est refusé", () => {
    expect(plan({ stored: { imageUrl: A, images: [] }, imageUrl: CATALOGUE, clearImageUrl: true })).toEqual({
      ok: false,
      messageFr: CLEAR_AND_SET_IMAGE_REFUSED_FR,
    });
    expect(CLEAR_AND_SET_IMAGE_REFUSED_FR).toBe("Choisissez : retirer la photo ou en indiquer une, pas les deux.");
  });

  it("clearImageUrl avec imageUrl null n'est pas une contradiction", () => {
    expect(plan({ stored: { imageUrl: A, images: [] }, imageUrl: null, clearImageUrl: true })).toEqual({
      ok: true,
      imageUrl: null,
    });
  });
});

describe("normalisation", () => {
  it("dédoublonne par url en gardant la première occurrence", () => {
    const result = plan({
      stored: null,
      images: [{ url: A, alt: "premier" }, { url: B }, { url: A, alt: "second", isPrimary: true }],
    });
    expect(result).toEqual({
      ok: true,
      images: [
        { url: A, alt: "premier", order: 0, isPrimary: true },
        { url: B, alt: null, order: 1, isPrimary: false },
      ],
      imageUrl: A,
    });
  });

  it("tri stable par (order ?? position), ordres réécrits 0..n-1", () => {
    const result = plan({
      stored: null,
      images: [
        { url: A, order: 7 },
        { url: B, order: 2 },
        { url: C, order: 2 },
      ],
    });
    expect(result.ok && result.images?.map((image) => [image.url, image.order])).toEqual([
      [B, 0],
      [C, 1],
      [A, 2],
    ]);
  });

  it("exactement une principale : la première marquée dans l'ordre trié, sinon la première", () => {
    const twoFlagged = plan({
      stored: null,
      images: [
        { url: A, order: 2, isPrimary: true },
        { url: B, order: 1, isPrimary: true },
        { url: C, order: 0 },
      ],
    });
    expect(twoFlagged.ok && twoFlagged.images?.filter((image) => image.isPrimary).map((image) => image.url)).toEqual([B]);
    expect(twoFlagged).toMatchObject({ imageUrl: B });

    const noneFlagged = plan({ stored: null, images: [{ url: B, order: 1 }, { url: A, order: 0 }] });
    expect(noneFlagged.ok && noneFlagged.images?.filter((image) => image.isPrimary).map((image) => image.url)).toEqual([A]);
    expect(noneFlagged).toMatchObject({ imageUrl: A });
  });

  it("alt sans espaces de bord, vide → null", () => {
    const result = plan({
      stored: null,
      images: [{ url: A, alt: "  Merguez  " }, { url: B, alt: "   " }, { url: C, alt: null }],
    });
    expect(result.ok && result.images?.map((image) => image.alt)).toEqual(["Merguez", null, null]);
  });
});
