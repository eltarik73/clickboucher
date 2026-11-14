// src/lib/images/columns.ts — Inventaire des colonnes de la base qui contiennent une URL d'image.
//
// Module pur. Sert au contrôle des références avant suppression d'une image, au recensement
// et aux scripts de réparation. Ces noms de table et de colonne sont les SEULS identifiants jamais
// interpolés dans du SQL brut (references.ts, census.ts, scripts/images) : aucune valeur venue
// d'une requête ne doit l'être. Le test image-columns.test.ts vérifie la liste contre
// prisma/schema.prisma ; une nouvelle colonne d'image doit être ajoutée ici.

export interface ImageColumn {
  table: string;
  column: string;
  nullable: boolean;
  /** Colonne qui désigne la boutique propriétaire (« id » pour la table shops), ou null. */
  shopIdColumn: string | null;
  /** Une URL morte y est remplacée par NULL lors de la réparation (l'affichage a un repli local). */
  nullWhenDead: boolean;
}

export const IMAGE_COLUMNS: readonly ImageColumn[] = [
  { table: "products", column: "image_url", nullable: true, shopIdColumn: "shop_id", nullWhenDead: true },
  { table: "product_images", column: "url", nullable: false, shopIdColumn: null, nullWhenDead: false },
  { table: "shops", column: "image_url", nullable: true, shopIdColumn: "id", nullWhenDead: true },
  { table: "shops", column: "banner_url", nullable: true, shopIdColumn: "id", nullWhenDead: false },
  { table: "shops", column: "owner_photo_url", nullable: true, shopIdColumn: "id", nullWhenDead: false },
  { table: "shops", column: "halal_cert_url", nullable: true, shopIdColumn: "id", nullWhenDead: false },
  { table: "categories", column: "image_url", nullable: true, shopIdColumn: "shop_id", nullWhenDead: false },
  { table: "generated_images", column: "image_url", nullable: false, shopIdColumn: "shop_id", nullWhenDead: false },
  { table: "offers", column: "banner_image_url", nullable: true, shopIdColumn: "shop_id", nullWhenDead: true },
  { table: "offers", column: "popup_image_url", nullable: true, shopIdColumn: "shop_id", nullWhenDead: true },
  { table: "campaigns", column: "visual_image_url", nullable: true, shopIdColumn: null, nullWhenDead: false },
  { table: "site_banners", column: "image_url", nullable: false, shopIdColumn: null, nullWhenDead: false },
  { table: "recipes", column: "image_url", nullable: true, shopIdColumn: null, nullWhenDead: false },
  { table: "reference_products", column: "image_url", nullable: true, shopIdColumn: null, nullWhenDead: false },
  { table: "reference_product_images", column: "url", nullable: false, shopIdColumn: null, nullWhenDead: false },
];
