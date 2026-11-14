// ═══════════════════════════════════════════════
// KLIK&GO — Photos locales de repli (public/img)
// Table mot-clé → photo, repli par catégorie, photos de boutique.
// Module pur : utilisable côté client et côté serveur.
// ═══════════════════════════════════════════════

// Mapping keyword → image locale par catégorie
const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  // === BOEUF ===
  "bavette": "/img/products/bavette-aloyau.jpg",
  "entrecote": "/img/products/entrecote-boeuf.jpg",
  "faux-filet": "/img/products/faux-filet.jpg",
  "faux filet": "/img/products/faux-filet.jpg",
  "steak hache": "/img/products/steak-hache.jpg",
  "viande hachee": "/img/products/viande-hachee.jpg",
  "hache": "/img/products/steak-hache.jpg",
  "brochettes de boeuf marine": "/img/products/brochettes-boeuf-marine.jpg",
  "brochettes de boeuf": "/img/products/brochettes-boeuf.jpg",
  "brochettes": "/img/products/brochettes-boeuf.jpg",
  "cote de boeuf": "/img/products/cote-de-boeuf.jpg",
  "basse cote": "/img/products/basse-cote.jpg",
  "plat de cotes": "/img/products/plat-de-cotes.jpg",
  "roti de boeuf": "/img/products/roti-boeuf-extra.jpg",
  "roti": "/img/products/roti-boeuf-extra.jpg",
  "onglet": "/img/products/onglet-boeuf.jpg",
  "tournedos": "/img/products/tournedos-boeuf.jpg",
  "rumsteak": "/img/products/rumsteak.jpg",
  "hampe": "/img/products/hampe.jpg",
  "boeuf marine": "/img/products/boeuf-marine.jpg",
  "bourguignon": "/img/products/rond-de-gite.jpg",
  "rond de gite": "/img/products/rond-de-gite.jpg",
  "carpaccio": "/img/products/entrecote-boeuf.jpg",
  "kefta": "/img/products/kefta-maison.jpg",
  "boulettes": "/img/products/kefta-maison.jpg",
  "steak": "/img/products/rumsteak.jpg",

  // === AGNEAU ===
  "selle d'agneau": "/img/products/selle-agneau.jpg",
  "carre d'agneau": "/img/products/carre-agneau.jpg",
  "cotes d'agneau": "/img/products/cotes-agneau-filet.jpg",
  "cotelettes": "/img/products/cotes-agneau-filet.jpg",
  "gigot": "/img/products/gigot-agneau.jpg",
  "epaule d'agneau": "/img/products/epaule-agneau.jpg",
  "epaule": "/img/products/epaule-agneau.jpg",
  "collier": "/img/products/collier-agneau.jpg",
  "poitrine d'agneau": "/img/products/poitrine-agneau.jpg",
  "brochettes d'agneau": "/img/products/brochettes-agneau.jpg",
  "souris": "/img/products/gigot-agneau.jpg",
  "agneau": "/img/products/gigot-agneau.jpg",

  // === VOLAILLE ===
  "poulet blanc": "/img/products/poulet-blanc.jpg",
  "poulet entier": "/img/products/poulet-blanc.jpg",
  "cuisses de poulet": "/img/products/cuisses-poulet.jpg",
  "filet de poulet": "/img/products/filet-poulet.jpg",
  "escalope de poulet": "/img/products/filet-poulet.jpg",
  "pilons": "/img/products/pilons-poulet.jpg",
  "poulet fermier": "/img/products/poulet-fermier.jpg",
  "poulet marine": "/img/products/poulet-marine.jpg",
  "poulet roti": "/img/products/poulet-roti.jpg",
  "ailes de poulet": "/img/products/ailes-poulet.jpg",
  "ailes": "/img/products/ailes-poulet.jpg",
  "brochettes de poulet": "/img/products/brochettes-poulet-marine.jpg",
  "cuisses de dinde": "/img/products/cuisses-dinde.jpg",
  "filet de dinde": "/img/products/filet-dinde.jpg",
  "escalope de dinde": "/img/products/filet-dinde.jpg",
  "dinde": "/img/products/filet-dinde.jpg",
  "cuisses": "/img/products/cuisses-poulet.jpg",
  "poulet": "/img/products/poulet-blanc.jpg",
  "emince": "/img/products/filet-poulet.jpg",
  "cordon bleu": "/img/products/filet-poulet.jpg",

  // === MERGUEZ / SAUCISSES ===
  "merguez": "/img/products/merguez.jpg",
  "chipolata": "/img/products/chipolatas.jpg",
  "saucisse": "/img/products/chipolatas.jpg",

  // === VEAU ===
  "roti de veau": "/img/products/roti-veau.jpg",
  "poitrine de veau": "/img/products/poitrine-veau.jpg",
  "jarret de veau": "/img/products/jarret-veau.jpg",
  "paupiettes": "/img/products/paupiettes-veau.jpg",
  "cote de veau": "/img/products/cote-veau-lait.jpg",
  "noix de veau": "/img/products/noix-veau.jpg",
  "escalope de veau": "/img/products/escalope-veau.jpg",
  "carre de veau": "/img/products/carre-veau.jpg",
  "tendrons": "/img/products/tendrons-veau.jpg",
  "blanquette": "/img/products/poitrine-veau.jpg",
  "veau": "/img/products/roti-veau.jpg",

  // === CHARCUTERIE ===
  "pastrami": "/img/products/pastrami-boeuf.jpg",
  "bacon": "/img/products/bacon-dinde.jpg",
  "rosette": "/img/products/rosette.jpg",
  "mortadelle": "/img/products/mortadelle.jpg",
  "delice de dinde": "/img/products/delice-dinde.jpg",
  "delice de poulet": "/img/products/delice-poulet.jpg",

  // === ABATS ===
  "foie": "/img/products/abats-1.jpg",
  "tripes": "/img/products/abats-1.jpg",
  "abats": "/img/products/abats-1.jpg",
};

// Fallback par catégorie
const CATEGORY_FALLBACKS: Record<string, string> = {
  "boeuf": "/img/products/entrecote-boeuf.jpg",
  "agneau": "/img/products/gigot-agneau.jpg",
  "volaille": "/img/products/poulet-blanc.jpg",
  "veau": "/img/products/roti-veau.jpg",
  "grillades": "/img/products/merguez.jpg",
  "saucisses": "/img/products/merguez.jpg",
  "charcuterie": "/img/products/pastrami-boeuf.jpg",
  "preparations": "/img/products/kefta-maison.jpg",
  "abats": "/img/products/abats-1.jpg",
};

export const DEFAULT_PRODUCT_PHOTO = "/img/products/boeuf-1.jpg";

/** Minuscules puis décomposition NFD sans les accents (la ligature « œ » ne se décompose pas). */
function withoutAccents(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Le mot-clé le plus long l'emporte ; à longueur égale, l'ordre de la table (tri stable).
const KEYWORDS_LONGEST_FIRST = Object.keys(DEFAULT_PRODUCT_IMAGES).sort((a, b) => b.length - a.length);

/** Photo locale choisie par un mot-clé contenu dans le nom du produit, ou null. */
export function keywordProductPhoto(name: string): string | null {
  const normalized = withoutAccents(name);
  const keyword = KEYWORDS_LONGEST_FIRST.find((candidate) => normalized.includes(candidate));
  return keyword === undefined ? null : DEFAULT_PRODUCT_IMAGES[keyword];
}

/** Photo locale de repli de la catégorie (tout caractère hors a-z retiré), ou null. */
export function categoryProductPhoto(category: string): string | null {
  const normalized = withoutAccents(category).replace(/[^a-z]/g, "");
  const key = Object.keys(CATEGORY_FALLBACKS).find((candidate) => normalized.includes(candidate));
  return key === undefined ? null : CATEGORY_FALLBACKS[key];
}

/**
 * Image d'un produit telle que la rendent le JSON-LD ProductSchema, les bons plans et la recherche :
 * l'imageUrl si elle commence par https:// ou / (hors replicate.delivery, qui expire),
 * sinon la photo du mot-clé, de la catégorie, puis la photo par défaut.
 * Comportement figé par le test « resolveProductImage ne change pas » ; l'affichage passe
 * désormais par resolveProductPhoto (src/lib/images/product-photo.ts).
 */
export function resolveProductImage(product: {
  name: string;
  imageUrl?: string | null;
  category?: string | null;
}): string {
  const { imageUrl } = product;
  if (
    imageUrl &&
    !imageUrl.includes("replicate.delivery") &&
    (imageUrl.startsWith("https://") || imageUrl.startsWith("/"))
  ) {
    return imageUrl;
  }
  return (
    keywordProductPhoto(product.name) ??
    categoryProductPhoto(product.category ?? "") ??
    DEFAULT_PRODUCT_PHOTO
  );
}

// ── Shop images ──

export const SHOP_IMAGES: string[] = [
  "/img/shops/shop-1.jpg",
  "/img/shops/shop-2.jpg",
  "/img/shops/shop-3.jpg",
  "/img/shops/shop-4.jpg",
  "/img/shops/shop-5.jpg",
  "/img/shops/shop-6.jpg",
  "/img/shops/shop-7.jpg",
  "/img/shops/shop-8.jpg",
  "/img/shops/shop-9.jpg",
  "/img/shops/shop-10.jpg",
];

export function getShopImage(index: number): string {
  return SHOP_IMAGES[index % SHOP_IMAGES.length];
}
