// @vitest-environment node
// Résolution de la photo d'un produit et d'une boutique (src/lib/images/product-photo.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRODUCT_PHOTO, SHOP_IMAGES } from "@/lib/product-images";
import {
  resolveProductPhoto,
  resolveShopPhoto,
  shopFallbackPhoto,
} from "@/lib/images/product-photo";

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com";
const OWN_A = `${BLOB}/shops/s1/product/a.webp`;
const OWN_B = `${BLOB}/shops/s1/product/b.webp`;
const OWN_C = `${BLOB}/shops/s1/product/c.webp`;
const UNSPLASH =
  "https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75";
const PEXELS = "https://images.pexels.com/photos/1/a.jpeg";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveProductPhoto", () => {
  it("photo principale, puis imageUrl, puis une seule photo locale", () => {
    const resolved = resolveProductPhoto({
      name: "Merguez",
      imageUrl: OWN_C,
      images: [
        { url: OWN_A, order: 0, isPrimary: false },
        { url: OWN_B, order: 1, isPrimary: true },
      ],
    });
    expect(resolved).toEqual({
      own: OWN_B,
      ownRejected: false,
      candidates: [OWN_B, OWN_C, "/img/products/merguez.jpg"],
    });
  });

  it("sans photo propre : own null et la photo locale seule (mot-clé, catégorie, défaut)", () => {
    expect(resolveProductPhoto({ name: "Merguez" })).toEqual({
      own: null,
      ownRejected: false,
      candidates: ["/img/products/merguez.jpg"],
    });
    expect(
      resolveProductPhoto({ name: "Plateau", category: "Volaille", images: [], imageUrl: null })
    ).toEqual({
      own: null,
      ownRejected: false,
      candidates: ["/img/products/poulet-blanc.jpg"],
    });
    expect(resolveProductPhoto({ name: "Plateau", category: null })).toEqual({
      own: null,
      ownRejected: false,
      candidates: [DEFAULT_PRODUCT_PHOTO],
    });
  });

  it.each([
    "https://x.replicate.delivery/a.png",
    "https://replicate.delivery/a.png",
    "data:image/png;base64,AA",
    "blob:https://x/1",
    "https://example.com/a.jpg",
    "http://images.unsplash.com/photo-1",
    "https://other.public.blob.vercel-storage.com/a.webp",
    "/api/uploads/products/a.webp",
    "/img/other/x.jpg",
  ])("%s n'apparaît jamais, et la photo propre est dite refusée", (bad) => {
    const resolved = resolveProductPhoto({
      name: "Merguez",
      imageUrl: bad,
      images: [{ url: bad, isPrimary: true, order: 0 }],
    });
    expect(resolved.candidates).not.toContain(bad);
    expect(resolved).toEqual({
      own: null,
      ownRejected: true,
      candidates: ["/img/products/merguez.jpg"],
    });
  });

  it("une principale illisible laisse passer imageUrl, qui n'est pas refusée", () => {
    const resolved = resolveProductPhoto({
      name: "Merguez",
      imageUrl: OWN_C,
      images: [{ url: "https://x.replicate.delivery/a.png", isPrimary: true, order: 0 }],
    });
    expect(resolved).toEqual({
      own: OWN_C,
      ownRejected: false,
      candidates: [OWN_C, "/img/products/merguez.jpg"],
    });
  });

  it("une imageUrl vide n'est pas une photo propre : rien n'est refusé", () => {
    expect(resolveProductPhoto({ name: "Merguez", imageUrl: "", images: [] }).ownRejected).toBe(
      false
    );
  });

  it("retire les doublons", () => {
    const resolved = resolveProductPhoto({
      name: "Merguez",
      imageUrl: "/img/products/merguez.jpg",
      images: [{ url: "/img/products/merguez.jpg", isPrimary: true, order: 0 }],
    });
    expect(resolved).toEqual({
      own: "/img/products/merguez.jpg",
      ownRejected: false,
      candidates: ["/img/products/merguez.jpg"],
    });
  });

  it("garde Unsplash et Pexels (affichage historique toléré)", () => {
    expect(resolveProductPhoto({ name: "Merguez", imageUrl: UNSPLASH }).candidates).toEqual([
      UNSPLASH,
      "/img/products/merguez.jpg",
    ]);
    expect(resolveProductPhoto({ name: "Kefta", images: [{ url: PEXELS }] })).toEqual({
      own: PEXELS,
      ownRejected: false,
      candidates: [PEXELS, "/img/products/kefta-maison.jpg"],
    });
  });

  it("le magasin local est montré hors production, jamais en production Vercel", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("KLIKGO_DEPLOY_ENV", "");
    const local = "/local-images/shops/s1/product/3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c.webp";
    expect(resolveProductPhoto({ name: "Merguez", imageUrl: local }).own).toBe(local);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(resolveProductPhoto({ name: "Merguez", imageUrl: local }).own).toBeNull();
  });
});

describe("resolveShopPhoto / shopFallbackPhoto", () => {
  it("photo de la boutique puis photo locale stable", () => {
    expect(resolveShopPhoto({ id: "a", imageUrl: "/img/shops/shop-3.jpg" })).toEqual({
      own: "/img/shops/shop-3.jpg",
      ownRejected: false,
      candidates: ["/img/shops/shop-3.jpg", shopFallbackPhoto("a")],
    });
    expect(resolveShopPhoto({ id: "a", imageUrl: "https://x.replicate.delivery/a.png" })).toEqual({
      own: null,
      ownRejected: true,
      candidates: [shopFallbackPhoto("a")],
    });
  });

  it("FNV-1a 32 bits non signé : vecteurs publiés", () => {
    // fnv1a32("a") = 0xe40c292c = 3826002220 → % 10 = 0 ; fnv1a32("b") = 0xe70c2de5 = 3876335077 → 7 ;
    // fnv1a32("foobar") = 0xbf9cf968 = 3214735720 → 0 (vecteurs de référence de FNV).
    expect(SHOP_IMAGES).toHaveLength(10);
    expect(shopFallbackPhoto("a")).toBe("/img/shops/shop-1.jpg");
    expect(shopFallbackPhoto("b")).toBe("/img/shops/shop-8.jpg");
    expect(shopFallbackPhoto("foobar")).toBe("/img/shops/shop-1.jpg");
  });

  it("même boutique, même photo, quel que soit l'ordre des appels ; au moins 4 photos sur 20 boutiques", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `cm${(i * 7919).toString(36)}shop${i}`);
    const forward = ids.map(shopFallbackPhoto);
    const backward = [...ids].reverse().map(shopFallbackPhoto).reverse();
    expect(backward).toEqual(forward);
    expect(new Set(forward).size).toBeGreaterThanOrEqual(4);
    for (const photo of forward) expect(SHOP_IMAGES).toContain(photo);
  });
});
