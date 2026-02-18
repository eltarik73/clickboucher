// ═══════════════════════════════════════════════
// KLIK&GO — Product Image Mapping
// Photos locales uniquement — AUCUNE URL externe
// ═══════════════════════════════════════════════

// Mapping keyword → image locale par catégorie
const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  // === BOEUF ===
  "entrecote": "/img/products/boeuf-1.jpg",
  "faux-filet": "/img/products/boeuf-2.jpg",
  "steak": "/img/products/boeuf-3.jpg",
  "viande hachee": "/img/products/boeuf-4.jpg",
  "hache": "/img/products/boeuf-4.jpg",
  "steak hache": "/img/products/boeuf-4.jpg",
  "brochettes": "/img/products/grillades-1.jpg",
  "cote de boeuf": "/img/products/boeuf-5.jpg",
  "roti": "/img/products/boeuf-2.jpg",
  "bourguignon": "/img/products/boeuf-3.jpg",
  "carpaccio": "/img/products/boeuf-1.jpg",
  "tournedos": "/img/products/boeuf-5.jpg",
  "rumsteak": "/img/products/boeuf-3.jpg",

  // === AGNEAU ===
  "cotelettes": "/img/products/agneau-1.jpg",
  "gigot": "/img/products/agneau-2.jpg",
  "epaule": "/img/products/agneau-3.jpg",
  "souris": "/img/products/agneau-4.jpg",
  "collier": "/img/products/agneau-1.jpg",
  "agneau": "/img/products/agneau-2.jpg",

  // === VOLAILLE ===
  "poulet": "/img/products/volaille-1.jpg",
  "escalope de poulet": "/img/products/volaille-2.jpg",
  "emince": "/img/products/volaille-3.jpg",
  "cuisses": "/img/products/volaille-4.jpg",
  "pilons": "/img/products/volaille-4.jpg",
  "ailes": "/img/products/volaille-3.jpg",
  "poulet entier": "/img/products/volaille-1.jpg",
  "dinde": "/img/products/volaille-2.jpg",
  "escalope de dinde": "/img/products/volaille-2.jpg",

  // === MERGUEZ / SAUCISSES ===
  "merguez": "/img/products/grillades-2.jpg",
  "saucisse": "/img/products/grillades-3.jpg",
  "chipolata": "/img/products/grillades-4.jpg",

  // === VEAU ===
  "escalope de veau": "/img/products/veau-1.jpg",
  "blanquette": "/img/products/veau-2.jpg",
  "veau": "/img/products/veau-1.jpg",

  // === PREPARATIONS ===
  "kefta": "/img/products/preparations-1.jpg",
  "boulettes": "/img/products/preparations-2.jpg",
  "cordon bleu": "/img/products/preparations-1.jpg",

  // === ABATS ===
  "foie": "/img/products/abats-1.jpg",
  "tripes": "/img/products/abats-1.jpg",
  "abats": "/img/products/abats-1.jpg",
};

// Fallback par catégorie
const CATEGORY_FALLBACKS: Record<string, string> = {
  "boeuf": "/img/products/boeuf-1.jpg",
  "agneau": "/img/products/agneau-1.jpg",
  "volaille": "/img/products/volaille-1.jpg",
  "veau": "/img/products/veau-1.jpg",
  "grillades": "/img/products/grillades-1.jpg",
  "preparations": "/img/products/preparations-1.jpg",
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
