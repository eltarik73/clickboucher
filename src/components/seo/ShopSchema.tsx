const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// Map short DB day keys → schema.org dayOfWeek
const DAY_MAP: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// Normalise "H:MM" or "HH:MM" → "HH:MM:00"
function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type HoursValue = { open?: string | null; close?: string | null } | null | undefined;

function buildOpeningHoursSpec(
  openingHours: Record<string, HoursValue> | null | undefined,
): Array<Record<string, unknown>> {
  if (!openingHours || typeof openingHours !== "object") return [];
  const out: Array<Record<string, unknown>> = [];
  for (const [key, value] of Object.entries(openingHours)) {
    const dayOfWeek = DAY_MAP[key.toLowerCase()];
    if (!dayOfWeek) continue;
    if (!value || !value.open || !value.close) continue;
    const opens = normalizeTime(value.open);
    const closes = normalizeTime(value.close);
    if (!opens || !closes) continue;
    out.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek,
      opens,
      closes,
    });
  }
  return out;
}

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
    openingHours?: Record<string, HoursValue> | null | unknown;
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
    currenciesAccepted: "EUR",
    paymentAccepted: "Cash, Credit Card",
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

  const openingSpec = buildOpeningHoursSpec(
    shop.openingHours as Record<string, HoursValue> | null | undefined,
  );
  if (openingSpec.length > 0) {
    schema.openingHoursSpecification = openingSpec;
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
