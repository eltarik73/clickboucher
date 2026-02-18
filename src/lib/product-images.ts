// ═══════════════════════════════════════════════
// KLIK&GO — Product Image Mapping
// Photos de viande CRUE uniquement (pas cuisinée)
// ═══════════════════════════════════════════════

// Mapping keyword → image Unsplash (viande crue, w=400 h=300 fit=crop q=75)
const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  // === BOEUF ===
  "entrecote": "https://images.unsplash.com/photo-1615937722923-67f6deaf2cc9?w=400&h=300&fit=crop&q=75",
  "faux-filet": "https://images.unsplash.com/photo-1615937722923-67f6deaf2cc9?w=400&h=300&fit=crop&q=75",
  "steak": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=75",
  "viande hachee": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop&q=75",
  "hache": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop&q=75",
  "steak hache": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop&q=75",
  "brochettes": "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop&q=75",
  "cote de boeuf": "https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=300&fit=crop&q=75",
  "roti": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&h=300&fit=crop&q=75",
  "bourguignon": "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75",
  "carpaccio": "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop&q=75",
  "tournedos": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=75",
  "rumsteak": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=75",

  // === AGNEAU ===
  "cotelettes": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75",
  "gigot": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75",
  "epaule": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75",
  "souris": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75",
  "collier": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75",
  "agneau": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75",

  // === VOLAILLE ===
  "poulet": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop&q=75",
  "escalope de poulet": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop&q=75",
  "emince": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop&q=75",
  "cuisses": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop&q=75",
  "pilons": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop&q=75",
  "ailes": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop&q=75",
  "poulet entier": "https://images.unsplash.com/photo-1501200291289-c5a76c232e5f?w=400&h=300&fit=crop&q=75",
  "dinde": "https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75",
  "escalope de dinde": "https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75",

  // === MERGUEZ / SAUCISSES ===
  "merguez": "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop&q=75",
  "saucisse": "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop&q=75",
  "chipolata": "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop&q=75",

  // === VEAU ===
  "escalope de veau": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&h=300&fit=crop&q=75",
  "blanquette": "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75",
  "veau": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&h=300&fit=crop&q=75",

  // === PREPARATIONS ===
  "kefta": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop&q=75",
  "boulettes": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop&q=75",
  "cordon bleu": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop&q=75",

  // === ABATS ===
  "foie": "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75",
  "tripes": "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75",
  "abats": "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75",
};

// Fallback par catégorie
const CATEGORY_FALLBACKS: Record<string, string> = {
  "boeuf": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=75",
  "agneau": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75",
  "volaille": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop&q=75",
  "veau": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&h=300&fit=crop&q=75",
  "grillades": "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop&q=75",
  "preparations": "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop&q=75",
  "abats": "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=75";

/**
 * Trouve la meilleure image pour un produit donné.
 * 1. Si le produit a une image uploadée → l'utiliser
 * 2. Chercher par mots-clés dans le nom du produit
 * 3. Fallback par catégorie
 * 4. Fallback ultime
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
  // Si le boucher a uploadé sa propre photo → l'utiliser
  if (product.imageUrl && !product.imageUrl.startsWith("/img/products/")) {
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

// ── Shop images (inchangé) ──

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
