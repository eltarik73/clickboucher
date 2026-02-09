const PRODUCT_IMAGES: Record<string, string[]> = {
  boeuf: [
    "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop",
  ],
  agneau: [
    "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1624174503860-5d9e3d345bd3?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1602473812169-ede22cd5fc9b?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1598103442097-8b74f7e1b4d5?w=400&h=300&fit=crop",
  ],
  volaille: [
    "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1501200291289-c5a76c232e5f?w=400&h=300&fit=crop",
  ],
  veau: [
    "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1602473812169-ede22cd5fc9b?w=400&h=300&fit=crop",
  ],
  grillades: [
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=300&fit=crop",
  ],
  preparations: [
    "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop",
  ],
  abats: [
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop",
  ],
  default: [
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop",
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
  "https://images.unsplash.com/photo-1542901031-ec5eeb518506?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1602473812169-ede22cd5fc9b?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop",
];

export function getShopImage(index: number): string {
  return SHOP_IMAGES[index % SHOP_IMAGES.length];
}
