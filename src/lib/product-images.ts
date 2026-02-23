// ═══════════════════════════════════════════════
// KLIK&GO — Product Image Mapping
// Photos locales uniquement — AUCUNE URL externe
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

const DEFAULT_IMAGE = "/img/products/boeuf-1.jpg";

/**
 * Trouve la meilleure image pour un produit donné.
 * 1. Chercher par mots-clés dans le nom du produit
 * 2. Fallback par catégorie
 * 3. Fallback ultime
 */
export function getProductImage(
  productNameOrCategory: string,
  _index?: number
): string {
  const name = productNameOrCategory
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1. Chercher par mots-clés (longest match first)
  const keywords = Object.keys(DEFAULT_PRODUCT_IMAGES).sort((a, b) => b.length - a.length);
  for (const keyword of keywords) {
    if (name.includes(keyword)) {
      return DEFAULT_PRODUCT_IMAGES[keyword];
    }
  }

  // 2. Fallback par catégorie
  const catKeys = Object.keys(CATEGORY_FALLBACKS);
  for (const cat of catKeys) {
    if (name.includes(cat)) {
      return CATEGORY_FALLBACKS[cat];
    }
  }

  // 3. Fallback ultime
  return DEFAULT_IMAGE;
}

/**
 * Résout l'image d'un produit complet (avec imageUrl, nom, catégorie)
 */
export function resolveProductImage(product: {
  name: string;
  imageUrl?: string | null;
  category?: string | null;
}): string {
  // Si le produit a une image locale assignée → l'utiliser en priorité
  if (product.imageUrl && product.imageUrl.startsWith("/img/")) {
    return product.imageUrl;
  }

  // Si le boucher a uploadé une image custom (ex: /uploads/...)
  if (product.imageUrl && product.imageUrl.startsWith("/")) {
    return product.imageUrl;
  }

  // Chercher par nom du produit
  const name = product.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const keywords = Object.keys(DEFAULT_PRODUCT_IMAGES).sort((a, b) => b.length - a.length);
  for (const keyword of keywords) {
    if (name.includes(keyword)) {
      return DEFAULT_PRODUCT_IMAGES[keyword];
    }
  }

  // Fallback par catégorie
  if (product.category) {
    const cat = product.category
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
    const catKeys = Object.keys(CATEGORY_FALLBACKS);
    for (const key of catKeys) {
      if (cat.includes(key)) {
        return CATEGORY_FALLBACKS[key];
      }
    }
  }

  return DEFAULT_IMAGE;
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
