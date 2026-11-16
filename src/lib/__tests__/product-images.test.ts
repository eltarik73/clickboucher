// @vitest-environment node
// Épingle du comportement historique de resolveProductImage (src/lib/product-images.ts), qui
// alimente le JSON-LD ProductSchema, et des photos locales par mot-clé et par catégorie.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_PHOTO,
  categoryProductPhoto,
  keywordProductPhoto,
  resolveProductImage,
} from "@/lib/product-images";

// Sorties d'aujourd'hui, relevées à la main sur la table des mots-clés (pas recalculées par le code).
const PINNED: ReadonlyArray<
  readonly [string, { name: string; imageUrl?: string | null; category?: string | null }, string]
> = [
  ["bœuf : mot-clé accentué", { name: "Entrecôte" }, "/img/products/entrecote-boeuf.jpg"],
  ["bœuf : le plus long l'emporte", { name: "Steak haché" }, "/img/products/steak-hache.jpg"],
  ["bœuf : steak seul", { name: "Steak" }, "/img/products/rumsteak.jpg"],
  ["bœuf : tiret", { name: "Faux-filet" }, "/img/products/faux-filet.jpg"],
  [
    "bœuf : mariné sans ligature",
    { name: "Brochettes de boeuf marinées" },
    "/img/products/brochettes-boeuf-marine.jpg",
  ],
  [
    "bœuf : la ligature œ ne se décompose pas",
    { name: "Brochettes de bœuf marinées" },
    "/img/products/brochettes-boeuf.jpg",
  ],
  ["bœuf : côte avec ligature → défaut", { name: "Côte de bœuf" }, "/img/products/boeuf-1.jpg"],
  ["bœuf : côte sans ligature", { name: "Côte de boeuf" }, "/img/products/cote-de-boeuf.jpg"],
  ["bœuf : bavette", { name: "Bavette d'aloyau" }, "/img/products/bavette-aloyau.jpg"],
  ["bœuf : kefta", { name: "Kefta" }, "/img/products/kefta-maison.jpg"],
  ["agneau : gigot", { name: "Gigot d'agneau" }, "/img/products/gigot-agneau.jpg"],
  ["agneau : épaule accentuée", { name: "Épaule d'agneau" }, "/img/products/epaule-agneau.jpg"],
  ["agneau : carré", { name: "Carré d'agneau" }, "/img/products/carre-agneau.jpg"],
  ["volaille : cuisses", { name: "Cuisses de poulet" }, "/img/products/cuisses-poulet.jpg"],
  ["volaille : ailes", { name: "Ailes de poulet" }, "/img/products/ailes-poulet.jpg"],
  [
    "volaille : brochettes",
    { name: "Brochettes de poulet" },
    "/img/products/brochettes-poulet-marine.jpg",
  ],
  ["volaille : dinde", { name: "Filet de dinde" }, "/img/products/filet-dinde.jpg"],
  [
    "volaille : égalité poulet / émincé, ordre de la table",
    { name: "Émincé de poulet" },
    "/img/products/poulet-blanc.jpg",
  ],
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
  [
    "catégorie Bœuf : la ligature ne donne rien → défaut",
    { name: "Plateau", category: "Bœuf" },
    "/img/products/boeuf-1.jpg",
  ],
  ["catégorie Boeuf", { name: "Plateau", category: "Boeuf" }, "/img/products/entrecote-boeuf.jpg"],
  [
    "catégorie Volaille",
    { name: "Plateau", category: "Volaille" },
    "/img/products/poulet-blanc.jpg",
  ],
  [
    "catégorie accentuée",
    { name: "Assortiment", category: "Préparations" },
    "/img/products/kefta-maison.jpg",
  ],
  [
    "catégorie, espaces et casse",
    { name: "X", category: "  VEAU  " },
    "/img/products/roti-veau.jpg",
  ],
  [
    "catégorie, caractères hors a-z retirés",
    { name: "X", category: "Vo laille" },
    "/img/products/poulet-blanc.jpg",
  ],
  [
    "catégorie, première clé de la table",
    { name: "X", category: "Bœuf & Veau" },
    "/img/products/roti-veau.jpg",
  ],
  ["catégorie vide → défaut", { name: "X", category: "" }, "/img/products/boeuf-1.jpg"],
  [
    "le mot-clé passe avant la catégorie",
    { name: "Merguez", category: "Volaille" },
    "/img/products/merguez.jpg",
  ],
  ["nom inconnu → défaut", { name: "Produit mystère" }, "/img/products/boeuf-1.jpg"],
  [
    "Unsplash https rendu tel quel",
    { name: "Entrecôte", imageUrl: "https://images.unsplash.com/photo-1" },
    "https://images.unsplash.com/photo-1",
  ],
  [
    "Blob https rendu tel quel",
    { name: "Merguez", imageUrl: "https://x.public.blob.vercel-storage.com/a.webp" },
    "https://x.public.blob.vercel-storage.com/a.webp",
  ],
  [
    "replicate.delivery → mot-clé",
    { name: "Merguez", imageUrl: "https://abc.replicate.delivery/x.png" },
    "/img/products/merguez.jpg",
  ],
  ["chemin relatif rendu tel quel", { name: "Merguez", imageUrl: "/x" }, "/x"],
  ["http → mot-clé", { name: "Merguez", imageUrl: "http://x" }, "/img/products/merguez.jpg"],
  [
    "data: → mot-clé",
    { name: "Steak", imageUrl: "data:image/png;base64,AA" },
    "/img/products/rumsteak.jpg",
  ],
  ["chaîne vide → mot-clé", { name: "Merguez", imageUrl: "" }, "/img/products/merguez.jpg"],
  [
    "null → catégorie",
    { name: "Plateau", imageUrl: null, category: "Volaille" },
    "/img/products/poulet-blanc.jpg",
  ],
];

describe("resolveProductImage ne change pas", () => {
  it.each(PINNED)("%s", (_label, product, expected) => {
    expect(resolveProductImage(product)).toBe(expected);
  });
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
