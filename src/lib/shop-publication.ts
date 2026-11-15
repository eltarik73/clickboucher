// src/lib/shop-publication.ts — is a shop listed, on vacation, unpublished or suspended? The one
// predicate behind the shop page, order intake and the public shop API. Pure: no I/O.
//
// Shop.visible means « listed ». Its writers are a closed list (admin moderation, vacation on and
// off, creation), and a suspension is its own stored state (Shop.suspendedAt), written and lifted
// by the admin only: a suspended shop is SUSPENDED whatever `visible` says.
import type { Prisma } from "@prisma/client";

export const shopPublicationSelect = {
  visible: true,
  suspendedAt: true,
  vacationMode: true,
} as const satisfies Prisma.ShopSelect;

/** suspendedAt is only tested for null: a value restored from a JSON cache (string) is fine. */
export type ShopPublicationFacts = {
  visible: boolean;
  suspendedAt: Date | string | null;
  vacationMode: boolean;
};

export type ShopPublication = "PUBLISHED" | "ON_VACATION" | "UNPUBLISHED" | "SUSPENDED";

/** Customer-facing refusal: says neither « suspended » nor « not validated ». */
export const SHOP_UNAVAILABLE_MESSAGE =
  "Cette boucherie n'est pas disponible à la commande pour le moment.";
export const SHOP_ON_VACATION_MESSAGE = "La boutique est en vacances";
export const SHOP_SUSPENDED_OWNER_MESSAGE =
  "Votre boutique est suspendue par Klik&Go. Contactez le support pour la réactiver.";
export const SHOP_NOT_PUBLISHED_OWNER_MESSAGE =
  "Votre boutique n'est pas encore en ligne : elle doit d'abord être validée par Klik&Go.";
export const SHOP_SUSPENDED_ADMIN_MESSAGE = "Boutique suspendue : réactivez-la d'abord";

export function shopPublication(shop: ShopPublicationFacts): ShopPublication {
  if (shop.suspendedAt !== null) return "SUSPENDED";
  if (shop.visible) return "PUBLISHED";
  if (shop.vacationMode) return "ON_VACATION";
  return "UNPUBLISHED";
}

/** A shop on vacation keeps its page (it shows its vacation message); it takes no order. */
export function isShopPageReachable(shop: ShopPublicationFacts): boolean {
  const publication = shopPublication(shop);
  return publication === "PUBLISHED" || publication === "ON_VACATION";
}

/** null only when the shop takes orders (PUBLISHED). */
export function shopOrderRefusalMessage(shop: ShopPublicationFacts): string | null {
  switch (shopPublication(shop)) {
    case "PUBLISHED":
      return null;
    case "ON_VACATION":
      return SHOP_ON_VACATION_MESSAGE;
    case "UNPUBLISHED":
    case "SUSPENDED":
      return SHOP_UNAVAILABLE_MESSAGE;
  }
}
