// Ce qu'un visiteur anonyme peut lire d'une boutique et d'un produit. Listes blanches explicites :
// une colonne ajoutée au schéma n'est jamais exposée tant qu'elle n'est pas ajoutée ici.
// Exclus volontairement : propriétaire, e-mail, Stripe Connect (sauf stripeChargesEnabled),
// commission, palier, chiffre d'affaires, informations légales, suspension, métriques internes,
// réglages d'acceptation ; côté produit, les prix magasin et pro, la TVA, le stock, le motif de
// mise en pause et le lien vers le catalogue de référence. Seuls les compteurs des modes à stock
// limité (anti-gaspi, vente flash) sont publics : la vitrine en tire « Épuisé » et « Plus que N ».
import type { Prisma } from "@prisma/client";
import { isAdmin } from "@/lib/roles";

export const publicShopSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  address: true,
  city: true,
  phone: true,
  imageUrl: true,
  bannerUrl: true,
  openingHours: true,
  status: true,
  busyMode: true,
  busyExtraMin: true,
  busyModeEndsAt: true,
  prepTimeMin: true,
  rating: true,
  ratingCount: true,
  minOrderCents: true,
  acceptOnline: true,
  acceptOnPickup: true,
  stripeChargesEnabled: true,
} as const satisfies Prisma.ShopSelect;

export const publicProductSelect = {
  id: true,
  shopId: true,
  name: true,
  description: true,
  imageUrl: true,
  priceCents: true,
  unit: true,
  unitLabel: true,
  inStock: true,
  isActive: true,
  displayOrder: true,
  popular: true,
  tags: true,
  origin: true,
  halalOrg: true,
  race: true,
  freshness: true,
  customerNote: true,
  originRegion: true,
  raceDescription: true,
  elevageMode: true,
  elevageDetail: true,
  halalMethod: true,
  freshDate: true,
  freshDetail: true,
  minWeightG: true,
  weightStepG: true,
  maxWeightG: true,
  sliceOptions: true,
  variants: true,
  weightPerPiece: true,
  pieceLabel: true,
  weightMargin: true,
  cutOptions: true,
  promoPct: true,
  promoEnd: true,
  promoType: true,
  promoFixedCents: true,
  packContent: true,
  packWeight: true,
  packOldPriceCents: true,
  isAntiGaspi: true,
  antiGaspiOrigPriceCents: true,
  antiGaspiStock: true,
  antiGaspiEndAt: true,
  antiGaspiReason: true,
  isFlashSale: true,
  flashSaleStock: true,
  snoozeType: true,
  snoozeEndsAt: true,
  categories: { select: { id: true, name: true, emoji: true } },
  images: {
    orderBy: { order: "asc" },
    select: { id: true, url: true, alt: true, order: true, isPrimary: true },
  },
  labels: { select: { id: true, name: true, color: true } },
} as const satisfies Prisma.ProductSelect;

/** Projection publique plus le tarif professionnel, jamais le prix magasin. */
export const proProductSelect = {
  ...publicProductSelect,
  proPriceCents: true,
} as const satisfies Prisma.ProductSelect;

/**
 * PUBLIC : projection publique. PRO : projection publique + tarif pro.
 * MANAGER : propriétaire de la boutique ou administrateur, ligne complète (formulaires d'édition).
 */
export type ProductPriceAudience = "PUBLIC" | "PRO" | "MANAGER";

export interface ProductViewer {
  /** Rôle lu en base (null ou undefined : utilisateur inconnu de la base). */
  role: string | null | undefined;
  /** Identifiants de l'appelant : clerkId, id Prisma, propriétaire résolu en mode test. */
  ids: ReadonlyArray<string | null | undefined>;
  /** shop.ownerId de la boutique du produit : clerkId OU id Prisma selon l'ancienneté. */
  shopOwnerId: string | null | undefined;
}

/** viewer = null pour un visiteur non connecté. */
export function productPriceAudience(viewer: ProductViewer | null): ProductPriceAudience {
  if (!viewer) return "PUBLIC";
  const ownerId = viewer.shopOwnerId;
  const ownsShop = !!ownerId && viewer.ids.includes(ownerId);
  if (ownsShop || isAdmin(viewer.role)) return "MANAGER";
  if (viewer.role === "CLIENT_PRO") return "PRO";
  return "PUBLIC";
}
