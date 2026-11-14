// @vitest-environment node
// Résolution de la photo d'un produit et d'une boutique (src/lib/images/product-photo.ts),
// et épingle du comportement historique de resolveProductImage (src/lib/product-images.ts),
// qui alimente le JSON-LD ProductSchema : la livraison A ne doit pas le changer.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRODUCT_PHOTO,
  SHOP_IMAGES,
  categoryProductPhoto,
  keywordProductPhoto,
  resolveProductImage,
} from "@/lib/product-images";
import {
  primaryImageOf,
  resolveProductPhoto,
  resolveShopPhoto,
  shopFallbackPhoto,
} from "@/lib/images/product-photo";

// Sorties d'aujourd'hui, relevées à la main sur la table des mots-clés (pas recalculées par le code).
const PINNED: ReadonlyArray<
  readonly [string, { name: string; imageUrl?: string | null; category?: string | null }, string]
> = [
  ["bœuf : mot-clé accentué", { name: "Entrecôte" }, "/img/products/entrecote-boeuf.jpg"],
  ["bœuf : le plus long l'emporte", { name: "Steak haché" }, "/img/products/steak-hache.jpg"],
  ["bœuf : steak seul", { name: "Steak" }, "/img/products/rumsteak.jpg"],
  ["bœuf : tiret", { name: "Faux-filet" }, "/img/products/faux-filet.jpg"],
  ["bœuf : mariné sans ligature", { name: "Brochettes de boeuf marinées" }, "/img/products/brochettes-boeuf-marine.jpg"],
  ["bœuf : la ligature œ ne se décompose pas", { name: "Brochettes de bœuf marinées" }, "/img/products/brochettes-boeuf.jpg"],
  ["bœuf : côte avec ligature → défaut", { name: "Côte de bœuf" }, "/img/products/boeuf-1.jpg"],
  ["bœuf : côte sans ligature", { name: "Côte de boeuf" }, "/img/products/cote-de-boeuf.jpg"],
  ["bœuf : bavette", { name: "Bavette d'aloyau" }, "/img/products/bavette-aloyau.jpg"],
  ["bœuf : kefta", { name: "Kefta" }, "/img/products/kefta-maison.jpg"],
  ["agneau : gigot", { name: "Gigot d'agneau" }, "/img/products/gigot-agneau.jpg"],
  ["agneau : épaule accentuée", { name: "Épaule d'agneau" }, "/img/products/epaule-agneau.jpg"],
  ["agneau : carré", { name: "Carré d'agneau" }, "/img/products/carre-agneau.jpg"],
  ["volaille : cuisses", { name: "Cuisses de poulet" }, "/img/products/cuisses-poulet.jpg"],
  ["volaille : ailes", { name: "Ailes de poulet" }, "/img/products/ailes-poulet.jpg"],
  ["volaille : brochettes", { name: "Brochettes de poulet" }, "/img/products/brochettes-poulet-marine.jpg"],
  ["volaille : dinde", { name: "Filet de dinde" }, "/img/products/filet-dinde.jpg"],
  ["volaille : égalité poulet / émincé, ordre de la table", { name: "Émincé de poulet" }, "/img/products/poulet-blanc.jpg"],
  ["volaille : cordon bleu", { name: "Cordon bleu" }, "/img/products/filet-poulet.jpg"],
  ["saucisses : majuscules", { name: "MERGUEZ maison" }, "/img/products/merguez.jpg"],
  ["saucisses : chipolatas", { name: "Chipolatas" }, "/img/products/chipolatas.jpg"],
  ["saucisses : saucisse", { name: "Saucisse fumée" }, "/img/products/chipolatas.jpg"],
  ["veau : escalope", { name: "Escalope de veau" }, "/img/products/escalope-veau.jpg"],
  ["veau : rôti", { name: "Rôti de veau" }, "/img/products/roti-veau.jpg"],
  ["veau : tendrons", { name: "Tendrons de veau" }, "/img/products/tendrons-veau.jpg"],
  ["veau : blanquette", { name: "Blanquette" }, "/img/products/poitrine-veau.jpg"],
  ["charcuterie : pastrami", { name: "Pastrami" }, "/img/products/pastrami-boeuf.jpg"],
  ["charcuterie : délice de dinde", { name: "Délice de dinde" }, "/img/products/delice-dinde.jpg"],
  ["abats : foie", { name: "Foie de génisse" }, "/img/products/abats-1.jpg"],
  ["catégorie Bœuf : la ligature ne donne rien → défaut", { name: "Plateau", category: "Bœuf" }, "/img/products/boeuf-1.jpg"],
  ["catégorie Boeuf", { name: "Plateau", category: "Boeuf" }, "/img/products/entrecote-boeuf.jpg"],
  ["catégorie Volaille", { name: "Plateau", category: "Volaille" }, "/img/products/poulet-blanc.jpg"],
  ["catégorie accentuée", { name: "Assortiment", category: "Préparations" }, "/img/products/kefta-maison.jpg"],
  ["catégorie, espaces et casse", { name: "X", category: "  VEAU  " }, "/img/products/roti-veau.jpg"],
  ["catégorie, caractères hors a-z retirés", { name: "X", category: "Vo laille" }, "/img/products/poulet-blanc.jpg"],
  ["catégorie, première clé de la table", { name: "X", category: "Bœuf & Veau" }, "/img/products/roti-veau.jpg"],
  ["catégorie vide → défaut", { name: "X", category: "" }, "/img/products/boeuf-1.jpg"],
  ["le mot-clé passe avant la catégorie", { name: "Merguez", category: "Volaille" }, "/img/products/merguez.jpg"],
  ["nom inconnu → défaut", { name: "Produit mystère" }, "/img/products/boeuf-1.jpg"],
  ["Unsplash https rendu tel quel", { name: "Entrecôte", imageUrl: "https://images.unsplash.com/photo-1" }, "https://images.unsplash.com/photo-1"],
  ["Blob https rendu tel quel", { name: "Merguez", imageUrl: "https://x.public.blob.vercel-storage.com/a.webp" }, "https://x.public.blob.vercel-storage.com/a.webp"],
  ["replicate.delivery → mot-clé", { name: "Merguez", imageUrl: "https://abc.replicate.delivery/x.png" }, "/img/products/merguez.jpg"],
  ["chemin relatif rendu tel quel", { name: "Merguez", imageUrl: "/x" }, "/x"],
  ["http → mot-clé", { name: "Merguez", imageUrl: "http://x" }, "/img/products/merguez.jpg"],
  ["data: → mot-clé", { name: "Steak", imageUrl: "data:image/png;base64,AA" }, "/img/products/rumsteak.jpg"],
  ["chaîne vide → mot-clé", { name: "Merguez", imageUrl: "" }, "/img/products/merguez.jpg"],
  ["null → catégorie", { name: "Plateau", imageUrl: null, category: "Volaille" }, "/img/products/poulet-blanc.jpg"],
];

describe("resolveProductImage ne change pas", () => {
  it.each(PINNED)("%s", (_label, product, expected) => {
    expect(resolveProductImage(product)).toBe(expected);
  });
});

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com";
const OWN_A = `${BLOB}/shops/s1/product/a.webp`;
const OWN_B = `${BLOB}/shops/s1/product/b.webp`;
const OWN_C = `${BLOB}/shops/s1/product/c.webp`;
const UNSPLASH = "https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75";
const PEXELS = "https://images.pexels.com/photos/1/a.jpeg";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("keywordProductPhoto / categoryProductPhoto", () => {
  it("renvoient null quand rien ne correspond", () => {
    expect(keywordProductPhoto("Produit mystère")).toBeNull();
    expect(keywordProductPhoto("")).toBeNull();
    expect(categoryProductPhoto("")).toBeNull();
    expect(categoryProductPhoto("Bœuf")).toBeNull();
  });

  it("gardent la normalisation d'aujourd'hui", () => {
    expect(keywordProductPhoto("ÉMINCÉ DE POULET")).toBe("/img/products/poulet-blanc.jpg");
    expect(categoryProductPhoto("Préparations")).toBe("/img/products/kefta-maison.jpg");
    expect(DEFAULT_PRODUCT_PHOTO).toBe("/img/products/boeuf-1.jpg");
  });
});

describe("primaryImageOf", () => {
  it("isPrimary l'emporte sur l'ordre", () => {
    const images = [
      { url: "a", order: 0, isPrimary: false },
      { url: "b", order: 1, isPrimary: true },
    ];
    expect(primaryImageOf(images)?.url).toBe("b");
  });

  it("deux images principales : la première dans l'ordre (order, position)", () => {
    const images = [
      { url: "late", order: 3, isPrimary: true },
      { url: "early", order: 1, isPrimary: true },
    ];
    expect(primaryImageOf(images)?.url).toBe("early");
  });

  it("aucune principale : le plus petit order, puis la position", () => {
    expect(primaryImageOf([{ url: "b", order: 2 }, { url: "a", order: 1 }, { url: "c", order: 1 }])?.url).toBe("a");
  });

  it("liste vide → null", () => {
    expect(primaryImageOf([])).toBeNull();
  });
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
    expect(resolved).toEqual({ own: OWN_B, candidates: [OWN_B, OWN_C, "/img/products/merguez.jpg"] });
  });

  it("sans photo propre : own null et la photo locale seule (mot-clé, catégorie, défaut)", () => {
    expect(resolveProductPhoto({ name: "Merguez" })).toEqual({
      own: null,
      candidates: ["/img/products/merguez.jpg"],
    });
    expect(resolveProductPhoto({ name: "Plateau", category: "Volaille", images: [], imageUrl: null })).toEqual({
      own: null,
      candidates: ["/img/products/poulet-blanc.jpg"],
    });
    expect(resolveProductPhoto({ name: "Plateau", category: null })).toEqual({
      own: null,
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
  ])("%s n'apparaît jamais", (bad) => {
    const resolved = resolveProductPhoto({
      name: "Merguez",
      imageUrl: bad,
      images: [{ url: bad, isPrimary: true, order: 0 }],
    });
    expect(resolved.candidates).not.toContain(bad);
    expect(resolved).toEqual({ own: null, candidates: ["/img/products/merguez.jpg"] });
  });

  it("une principale illisible laisse passer imageUrl", () => {
    const resolved = resolveProductPhoto({
      name: "Merguez",
      imageUrl: OWN_C,
      images: [{ url: "https://x.replicate.delivery/a.png", isPrimary: true, order: 0 }],
    });
    expect(resolved).toEqual({ own: OWN_C, candidates: [OWN_C, "/img/products/merguez.jpg"] });
  });

  it("retire les doublons", () => {
    const resolved = resolveProductPhoto({
      name: "Merguez",
      imageUrl: "/img/products/merguez.jpg",
      images: [{ url: "/img/products/merguez.jpg", isPrimary: true, order: 0 }],
    });
    expect(resolved).toEqual({ own: "/img/products/merguez.jpg", candidates: ["/img/products/merguez.jpg"] });
  });

  it("garde Unsplash et Pexels (affichage historique toléré)", () => {
    expect(resolveProductPhoto({ name: "Merguez", imageUrl: UNSPLASH }).candidates).toEqual([
      UNSPLASH,
      "/img/products/merguez.jpg",
    ]);
    expect(resolveProductPhoto({ name: "Kefta", images: [{ url: PEXELS }] })).toEqual({
      own: PEXELS,
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
      candidates: ["/img/shops/shop-3.jpg", shopFallbackPhoto("a")],
    });
    expect(resolveShopPhoto({ id: "a", imageUrl: "https://x.replicate.delivery/a.png" })).toEqual({
      own: null,
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
