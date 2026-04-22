const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

interface ProductSchemaProps {
  product: {
    id: string;
    name: string;
    description?: string | null;
    priceCents: number;
    imageUrl?: string | null;
    inStock?: boolean;
    category?: { name: string } | null;
  };
  shop: {
    name: string;
    slug: string;
  };
}

export function ProductSchema({ product, shop }: ProductSchemaProps) {
  // Normalize image URL → absolute (schema.org recommends absolute URLs for rich results)
  const absoluteImage = product.imageUrl
    ? product.imageUrl.startsWith("http")
      ? product.imageUrl
      : `${SITE_URL}${product.imageUrl.startsWith("/") ? "" : "/"}${product.imageUrl}`
    : null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description && { description: product.description }),
    ...(absoluteImage && { image: absoluteImage }),
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: shop.name,
    },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/boutique/${shop.slug}`,
      priceCurrency: "EUR",
      price: (product.priceCents / 100).toFixed(2),
      availability:
        product.inStock !== false
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: shop.name,
      },
    },
    ...(product.category?.name && { category: product.category.name }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
