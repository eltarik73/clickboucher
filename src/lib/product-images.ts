const PRODUCT_IMAGES: Record<string, string[]> = {
  boeuf: [
    "/img/products/boeuf-1.jpg",
    "/img/products/boeuf-2.jpg",
    "/img/products/boeuf-3.jpg",
    "/img/products/boeuf-4.jpg",
    "/img/products/boeuf-5.jpg",
  ],
  agneau: [
    "/img/products/agneau-1.jpg",
    "/img/products/agneau-2.jpg",
    "/img/products/agneau-3.jpg",
    "/img/products/agneau-4.jpg",
  ],
  volaille: [
    "/img/products/volaille-1.jpg",
    "/img/products/volaille-2.jpg",
    "/img/products/volaille-3.jpg",
    "/img/products/volaille-4.jpg",
  ],
  veau: [
    "/img/products/veau-1.jpg",
    "/img/products/veau-2.jpg",
  ],
  grillades: [
    "/img/products/grillades-1.jpg",
    "/img/products/grillades-2.jpg",
    "/img/products/grillades-3.jpg",
    "/img/products/grillades-4.jpg",
  ],
  preparations: [
    "/img/products/preparations-1.jpg",
    "/img/products/preparations-2.jpg",
  ],
  abats: [
    "/img/products/abats-1.jpg",
  ],
  default: [
    "/img/products/boeuf-1.jpg",
  ],
};

export function getProductImage(categoryName: string, productIndex: number = 0): string {
  const normalized = categoryName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

  const key =
    Object.keys(PRODUCT_IMAGES).find((k) => normalized.includes(k)) || "default";
  const images = PRODUCT_IMAGES[key];
  return images[productIndex % images.length];
}

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
