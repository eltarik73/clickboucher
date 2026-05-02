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
    // Used to derive aggregateRating on the product (the shop is the seller).
    // Without it, GSC flags "Champ aggregateRating manquant" on Product snippets
    // and we miss the ⭐ stars in SERP.
    rating?: number | null;
    ratingCount?: number | null;
  };
  // Optional sample reviews (max 2) attached to the product schema for rich snippets.
  // We pass shop-level reviews because reviews are stored per shop, not per product.
  reviews?: Array<{
    rating: number;
    comment: string | null;
    authorName: string;
    createdAt: Date | string;
  }>;
}

export function ProductSchema({ product, shop, reviews }: ProductSchemaProps) {
  // Normalize image URL → absolute (schema.org recommends absolute URLs for rich results)
  const absoluteImage = product.imageUrl
    ? product.imageUrl.startsWith("http")
      ? product.imageUrl
      : `${SITE_URL}${product.imageUrl.startsWith("/") ? "" : "/"}${product.imageUrl}`
    : null;

  const hasRating =
    typeof shop.rating === "number" &&
    typeof shop.ratingCount === "number" &&
    shop.ratingCount > 0 &&
    shop.rating > 0;

  const reviewsWithText = (reviews ?? [])
    .filter((r) => r.comment && r.comment.trim().length > 0)
    .slice(0, 2);

  const schema: Record<string, unknown> = {
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

  if (hasRating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(shop.rating).toFixed(1),
      reviewCount: shop.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviewsWithText.length > 0) {
    schema.review = reviewsWithText.map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: r.authorName },
      reviewBody: r.comment,
      datePublished:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
