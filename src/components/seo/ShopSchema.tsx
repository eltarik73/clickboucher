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
  openingHours: Record<string, HoursValue> | null | undefined
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
  // Reviews vivent au niveau Shop (et non Product) car les avis concernent
  // la boucherie en tant qu'entité — pas chaque produit individuellement.
  // Les passer au Product duplique les mêmes avis sur N produits → Google
  // détecte le pattern et ignore les rich snippets (audit bot 2026-05-06 Agent B).
  reviews?: Array<{
    rating: number;
    comment: string | null;
    authorName: string;
    createdAt: Date | string;
  }>;
}

export function ShopSchema({ shop, reviews }: ShopSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    // Triple-type : Store (retail rich results) + LocalBusiness (Pack Local)
    // + FoodEstablishment (signal halal certifié food retail). Annuaire local
    // SEO Sprint 12 (audit mai 2026).
    "@type": ["Store", "FoodEstablishment", "LocalBusiness"],
    "@id": `${SITE_URL}/boutique/${shop.slug}`,
    name: shop.name,
    ...(shop.city && { alternateName: `${shop.name} ${shop.city}` }),
    url: `${SITE_URL}/boutique/${shop.slug}`,
    ...(shop.description && { description: shop.description }),
    ...(shop.phone && { telephone: shop.phone }),
    // Image en URL ABSOLUE — schema.org Rich Results exige des URLs absolues.
    // Sinon Google les rejette silencieusement et le panneau Local Business
    // reste sans visuel. Audit bot quotidien 2026-05-04 (Agent B).
    ...(shop.imageUrl && {
      image: shop.imageUrl.startsWith("http")
        ? shop.imageUrl
        : `${SITE_URL}${shop.imageUrl.startsWith("/") ? "" : "/"}${shop.imageUrl}`,
    }),
    priceRange: "€€",
    currenciesAccepted: "EUR",
    paymentAccepted: "Cash, Credit Card",
    servesCuisine: ["Halal", "Méditerranéenne"],
    acceptsReservations: false,
    keywords: shop.city
      ? `boucherie halal, click and collect, ${shop.city}, viande halal certifiée`
      : "boucherie halal, click and collect, viande halal certifiée",
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
    shop.openingHours as Record<string, HoursValue> | null | undefined
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

  // Embed reviews on the Shop (LocalBusiness) — c'est l'entité reviewable.
  // Limité à 2 avis pour éviter de gonfler le payload SSR sans bénéfice SERP.
  const reviewsWithText = (reviews ?? [])
    .filter((r) => r.comment && r.comment.trim().length > 0)
    .slice(0, 2);
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
      datePublished: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
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
