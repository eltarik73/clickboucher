import { JsonLd } from "@/components/seo/JsonLd";
import type { VerifiedShopRating } from "@/lib/reviews/verified-rating";
import { buildShopJsonLd, type ShopJsonLdInput } from "@/lib/seo/jsonld/shop";

// Rendered by the shop page only: list pages never describe a shop entity.
export function ShopSchema({
  shop,
  rating,
}: {
  shop: ShopJsonLdInput;
  rating: VerifiedShopRating | null;
}) {
  return <JsonLd data={buildShopJsonLd(shop, rating)} />;
}
