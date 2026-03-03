const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

interface ShopSchemaProps {
  shop: {
    name: string;
    slug: string;
    description?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    zipCode?: string | null;
    imageUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    rating?: number | null;
    ratingCount?: number | null;
  };
}

export function ShopSchema({ shop }: ShopSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${SITE_URL}/boutique/${shop.slug}`,
    name: shop.name,
    url: `${SITE_URL}/boutique/${shop.slug}`,
    ...(shop.description && { description: shop.description }),
    ...(shop.phone && { telephone: shop.phone }),
    ...(shop.imageUrl && { image: shop.imageUrl }),
    priceRange: "€€",
    servesCuisine: "Halal",
  };

  if (shop.address) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: shop.address,
      ...(shop.city && { addressLocality: shop.city }),
      ...(shop.zipCode && { postalCode: shop.zipCode }),
      addressRegion: "Auvergne-Rhône-Alpes",
      addressCountry: "FR",
    };
  }

  if (shop.latitude && shop.longitude) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: shop.latitude,
      longitude: shop.longitude,
    };
  }

  if (shop.rating && shop.ratingCount && shop.ratingCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: shop.rating,
      reviewCount: shop.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  schema.potentialAction = {
    "@type": "OrderAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/boutique/${shop.slug}`,
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
