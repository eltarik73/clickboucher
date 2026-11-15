import { JsonLd } from "@/components/seo/JsonLd";
import { buildProductJsonLd, type ProductJsonLdInput } from "@/lib/seo/jsonld/product";

export function ProductSchema({
  product,
  shop,
}: {
  product: ProductJsonLdInput;
  shop: { name: string; slug: string };
}) {
  return <JsonLd data={buildProductJsonLd(product, shop)} />;
}
