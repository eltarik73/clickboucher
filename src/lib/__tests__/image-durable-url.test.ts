// @vitest-environment node
// Règle « URL durable » et règle d'écriture des images (src/lib/images/durable-url.ts),
// noms des fichiers stockés et URL de vignette (src/lib/images/thumbnail.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_BLOB_HOST,
  IMAGE_URL_REFUSED_FR,
  classifyImageUrl,
  imageBlobHost,
  imageRefSchema,
  imageWriteRefusal,
  isDisplayableImageUrl,
  isDurableImageUrl,
  isStoreImageUrl,
} from "@/lib/images/durable-url";
import { THUMB_SUFFIX, imagePathnames, thumbnailOf } from "@/lib/images/thumbnail";

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com";
const UUID = "3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c";
const LOCAL_STORE_URL = `/local-images/shops/abc/product/${UUID}.webp`;

function neutralEnv(): void {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("KLIKGO_DEPLOY_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_IMAGE_BLOB_HOST", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDurableImageUrl — accepte", () => {
  it.each([
    `${BLOB}/shops/a/product/x.webp`,
    `${BLOB}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`,
    "/img/products/x.jpg",
    "/img/products/filet-dinde.jpg",
    "/img/shops/shop-3.jpg",
    "/img/recipes/couscous-royal.jpg",
    "/img/products/a-b.webp",
  ])("%s", (value) => {
    neutralEnv();
    expect(isDurableImageUrl(value)).toBe(true);
    expect(isDisplayableImageUrl(value)).toBe(true);
  });

  it("le magasin local est durable hors production Vercel", () => {
    neutralEnv();
    expect(classifyImageUrl(LOCAL_STORE_URL)).toBe("LOCAL_STORE");
    expect(isDurableImageUrl(LOCAL_STORE_URL)).toBe(true);
  });

  it("le magasin local n'est pas durable en production Vercel (VERCEL_ENV)", () => {
    neutralEnv();
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isDurableImageUrl(LOCAL_STORE_URL)).toBe(false);
    expect(isDisplayableImageUrl(LOCAL_STORE_URL)).toBe(false);
  });

  it("le magasin local n'est pas durable en production Vercel (KLIKGO_DEPLOY_ENV figé au build)", () => {
    neutralEnv();
    vi.stubEnv("KLIKGO_DEPLOY_ENV", "production");
    expect(isDurableImageUrl(LOCAL_STORE_URL)).toBe(false);
  });
});

describe("isDurableImageUrl — refuse", () => {
  it.each<[string, string]>([
    ["https://x.replicate.delivery/a.png", "EXPIRING"],
    ["https://replicate.delivery/a.png", "EXPIRING"],
    ["http://pbxt.replicate.delivery/a.png", "EXPIRING"],
    ["https://images.unsplash.com/photo-1", "LEGACY_DISPLAY"],
    ["https://images.pexels.com/photos/1/a.jpeg?w=800", "LEGACY_DISPLAY"],
    ["https://other.public.blob.vercel-storage.com/a.webp", "FOREIGN_BLOB"],
    [`http://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/a.webp`, "OTHER"],
    [`https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com:8443/a.webp`, "OTHER"],
    [`https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com:443/a.webp`, "OTHER"],
    [`https://user:pass@nzqbbcqekyom7ajd.public.blob.vercel-storage.com/a.webp`, "OTHER"],
    [`https://user@nzqbbcqekyom7ajd.public.blob.vercel-storage.com/a.webp`, "OTHER"],
    [`${BLOB}/a.webp?x=1`, "OTHER"],
    [`${BLOB}/a.webp?`, "OTHER"],
    [`${BLOB}/a.webp#frag`, "OTHER"],
    [`${BLOB}/`, "OTHER"],
    [`${BLOB}/a/../b.webp`, "OTHER"],
    ["https://NZQBBCQEKYOM7AJD.public.blob.vercel-storage.com/a.webp", "OTHER"],
    ["data:image/png;base64,AA", "DATA"],
    ["blob:https://x/1", "DATA"],
    ["javascript:alert(1)", "OTHER"],
    ["/img/../x", "OTHER"],
    ["/img/other/x.jpg", "OTHER"],
    ["/img/products/X.JPG", "OTHER"],
    ["/img/products/../shops/x.jpg", "OTHER"],
    ["/img/products/x.svg", "OTHER"],
    ["/img/products/x.jpg?v=1", "OTHER"],
    ["img/products/x.jpg", "OTHER"],
    ["//evil.example/x.jpg", "OTHER"],
    ["/api/uploads/products/a.webp", "LEGACY_UPLOAD_PATH"],
    ["/local-images/../x.webp", "OTHER"],
    [`/local-images/${UUID}.webp`, "OTHER"],
    ["https://example.com/a.jpg", "OTHER"],
    ["https://klikandgo.app/img/products/x.jpg", "OTHER"],
    ["not a url", "OTHER"],
    [" /img/products/x.jpg", "OTHER"],
    ["/img/products/x.jpg\n", "OTHER"],
    ["/img/products/x\u0000.jpg", "OTHER"],
    ["", "OTHER"],
  ])("%s → %s", (value, kind) => {
    neutralEnv();
    expect(classifyImageUrl(value)).toBe(kind);
    expect(isDurableImageUrl(value)).toBe(false);
  });

  it("une URL de 2049 caractères n'est pas durable, une de 2048 l'est", () => {
    neutralEnv();
    const prefix = `${BLOB}/`;
    const at2048 = prefix + "a".repeat(2048 - prefix.length);
    expect(at2048).toHaveLength(2048);
    expect(isDurableImageUrl(at2048)).toBe(true);
    expect(classifyImageUrl(at2048 + "a")).toBe("OTHER");
    expect(isDurableImageUrl(at2048 + "a")).toBe(false);
  });

  it("Unsplash et Pexels sont affichables, jamais durables", () => {
    neutralEnv();
    expect(isDisplayableImageUrl("https://images.unsplash.com/photo-1?w=400&h=300&fit=crop&q=75")).toBe(true);
    expect(isDisplayableImageUrl("https://images.pexels.com/photos/1/a.jpeg")).toBe(true);
    expect(isDisplayableImageUrl("http://images.unsplash.com/photo-1")).toBe(false);
    expect(isDisplayableImageUrl("https://x.replicate.delivery/a.png")).toBe(false);
    expect(isDisplayableImageUrl("https://other.public.blob.vercel-storage.com/a.webp")).toBe(false);
    expect(isDisplayableImageUrl("/api/uploads/products/a.webp")).toBe(false);
  });
});

describe("hôte Blob épinglé", () => {
  it("vaut l'hôte de production par défaut", () => {
    neutralEnv();
    expect(DEFAULT_IMAGE_BLOB_HOST).toBe("nzqbbcqekyom7ajd.public.blob.vercel-storage.com");
    expect(imageBlobHost()).toBe(DEFAULT_IMAGE_BLOB_HOST);
  });

  it("NEXT_PUBLIC_IMAGE_BLOB_HOST change l'hôte accepté", () => {
    neutralEnv();
    vi.stubEnv("NEXT_PUBLIC_IMAGE_BLOB_HOST", "Other.Public.Blob.Vercel-Storage.com");
    expect(imageBlobHost()).toBe("other.public.blob.vercel-storage.com");
    expect(classifyImageUrl("https://other.public.blob.vercel-storage.com/a.webp")).toBe("BLOB");
    expect(isDurableImageUrl("https://other.public.blob.vercel-storage.com/a.webp")).toBe(true);
    expect(classifyImageUrl(`${BLOB}/a.webp`)).toBe("FOREIGN_BLOB");
    expect(isDurableImageUrl(`${BLOB}/a.webp`)).toBe(false);
  });
});

describe("imageWriteRefusal — droit acquis et périmètre", () => {
  const unsplash = "https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75";
  const own = `${BLOB}/shops/a/product/${UUID}.webp`;
  const none = { stored: new Set<string>(), inScope: new Set<string>() };
  const storedOnly = (...values: string[]) => ({ stored: new Set(values), inScope: new Set<string>() });

  it("accepte une valeur Unsplash déjà enregistrée sur la ligne", () => {
    neutralEnv();
    expect(imageWriteRefusal(unsplash, storedOnly(unsplash))).toBeNull();
  });

  it("refuse une nouvelle valeur Unsplash", () => {
    neutralEnv();
    expect(imageWriteRefusal(unsplash, none)).toBe(IMAGE_URL_REFUSED_FR);
    expect(imageWriteRefusal(unsplash, storedOnly("https://images.unsplash.com/photo-2"))).toBe(IMAGE_URL_REFUSED_FR);
  });

  it("compare à l'identique : une variante de la valeur enregistrée est nouvelle", () => {
    neutralEnv();
    expect(imageWriteRefusal(`${unsplash}&x=1`, storedOnly(unsplash))).toBe(IMAGE_URL_REFUSED_FR);
  });

  it("une photo du site (/img) est acceptée sans périmètre", () => {
    neutralEnv();
    expect(imageWriteRefusal("/img/products/filet-dinde.jpg", none)).toBeNull();
  });

  it("un fichier de notre magasin n'est accepté que dans le périmètre de la ligne", () => {
    neutralEnv();
    expect(imageWriteRefusal(own, none)).toBe(IMAGE_URL_REFUSED_FR);
    expect(imageWriteRefusal(own, { stored: new Set(), inScope: new Set([own]) })).toBeNull();
    expect(imageWriteRefusal(LOCAL_STORE_URL, none)).toBe(IMAGE_URL_REFUSED_FR);
    expect(imageWriteRefusal(LOCAL_STORE_URL, { stored: new Set(), inScope: new Set([LOCAL_STORE_URL]) })).toBeNull();
  });

  it("un fichier de notre magasin déjà enregistré sur la ligne garde son droit acquis", () => {
    neutralEnv();
    expect(imageWriteRefusal(own, storedOnly(own))).toBeNull();
  });

  it("le périmètre ne rend pas durable une valeur qui ne l'est pas", () => {
    neutralEnv();
    expect(imageWriteRefusal(unsplash, { stored: new Set(), inScope: new Set([unsplash]) })).toBe(IMAGE_URL_REFUSED_FR);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(imageWriteRefusal(LOCAL_STORE_URL, { stored: new Set(), inScope: new Set([LOCAL_STORE_URL]) })).toBe(
      IMAGE_URL_REFUSED_FR
    );
  });

  it("refuse replicate.delivery même enregistrée ailleurs", () => {
    neutralEnv();
    expect(imageWriteRefusal("https://x.replicate.delivery/a.png", storedOnly("https://y.replicate.delivery/b.png"))).toBe(
      IMAGE_URL_REFUSED_FR
    );
  });

  it("le message est en français", () => {
    expect(IMAGE_URL_REFUSED_FR).toBe(
      "Photo refusée : utilisez une photo envoyée depuis Klik&Go ou une photo du catalogue du site."
    );
  });
});

describe("isStoreImageUrl — un fichier de notre magasin", () => {
  it.each<[string, boolean]>([
    [`${BLOB}/shops/a/product/${UUID}.webp`, true],
    [`${BLOB}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`, true],
    [LOCAL_STORE_URL, true],
    ["/img/products/filet-dinde.jpg", false],
    ["https://other.public.blob.vercel-storage.com/a.webp", false],
    ["https://images.unsplash.com/photo-1", false],
  ])("%s → %s", (value, expected) => {
    neutralEnv();
    expect(isStoreImageUrl(value)).toBe(expected);
  });
});

describe("schémas Zod", () => {
  it("imageRefSchema ne contrôle que la forme", () => {
    expect(imageRefSchema.parse("https://images.unsplash.com/photo-1")).toBe("https://images.unsplash.com/photo-1");
    expect(imageRefSchema.safeParse("").success).toBe(false);
    expect(imageRefSchema.safeParse("   ").success).toBe(false);
    expect(imageRefSchema.safeParse("a".repeat(2049)).success).toBe(false);
    expect(imageRefSchema.safeParse(42).success).toBe(false);
  });
});

describe("imagePathnames", () => {
  it("boutique : shops/<shopId>/<usage>/<id>.webp et sa vignette -t", () => {
    expect(imagePathnames({ shopId: "cm9shop1" }, "PRODUCT", UUID)).toEqual({
      id: UUID,
      master: `shops/cm9shop1/product/${UUID}.webp`,
      thumb: `shops/cm9shop1/product/${UUID}${THUMB_SUFFIX}.webp`,
    });
  });

  it("plateforme : platform/<usage>/<id>.webp, usage en minuscules avec tirets", () => {
    expect(imagePathnames({ shopId: null }, "RETOUCH_SOURCE", UUID)).toEqual({
      id: UUID,
      master: `platform/retouch-source/${UUID}.webp`,
      thumb: `platform/retouch-source/${UUID}-t.webp`,
    });
  });

  it.each([
    [{ shopId: "../x" }, "PRODUCT", UUID],
    [{ shopId: "Shop1" }, "PRODUCT", UUID],
    [{ shopId: "" }, "PRODUCT", UUID],
    [{ shopId: "s1" }, "PRODUCT", "a/b"],
    [{ shopId: "s1" }, "PRODUCT", "A1"],
    [{ shopId: "s1" }, "PRODUCT", ""],
    [{ shopId: "s1" }, "a/b", UUID],
  ])("refuse un segment hors [a-z0-9-] : %j %s %s", (scope, usage, id) => {
    expect(() => imagePathnames(scope, usage, id)).toThrow();
  });
});

describe("thumbnailOf", () => {
  it("photo du magasin Blob nommée <uuid>.webp → <uuid>-t.webp", () => {
    neutralEnv();
    const { master, thumb } = imagePathnames({ shopId: "s1" }, "PRODUCT", UUID);
    expect(thumbnailOf(`${BLOB}/${master}`)).toBe(`${BLOB}/${thumb}`);
  });

  it("photo du magasin local → vignette locale", () => {
    neutralEnv();
    expect(thumbnailOf(LOCAL_STORE_URL)).toBe(`/local-images/shops/abc/product/${UUID}-t.webp`);
  });

  it.each([
    `${BLOB}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`,
    `${BLOB}/shops/s1/product/${UUID}-t.webp`,
    `${BLOB}/shops/s1/product/${UUID.toUpperCase()}.webp`,
    `${BLOB}/shops/s1/product/3f2b8c1e-9d4a-1b7e-8f21-0c5d6e7a8b9c.webp`,
    `${BLOB}/shops/s1/product/${UUID}.png`,
    `https://other.public.blob.vercel-storage.com/shops/s1/product/${UUID}.webp`,
    `https://x.replicate.delivery/${UUID}.webp`,
    "/img/products/filet-dinde.jpg",
    "https://images.unsplash.com/photo-1",
  ])("pas de vignette pour %s", (url) => {
    neutralEnv();
    expect(thumbnailOf(url)).toBeNull();
  });
});
