import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, ArrowRight } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";

const PAGE_LAST_UPDATED = "2026-05-01";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// Top 12 villes (revalidate hourly)
export const revalidate = 3600;

const ELIGIBLE_CITIES = [
  "lyon",
  "grenoble",
  "saint-etienne",
  "chambery",
  "annecy",
  "aix-les-bains",
  "villeurbanne",
  "venissieux",
  "vaulx-en-velin",
  "annemasse",
  "voiron",
  "echirolles",
  "bron",
  "saint-priest",
  "bourgoin-jallieu",
];

export async function generateStaticParams() {
  return ELIGIBLE_CITIES.map((slug) => ({ ville: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { ville: string };
}): Promise<Metadata> {
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!city) return { title: "Ville introuvable" };

  // Best practice 2026 : noindex auto si shopCount === 0 (Mars Core Update).
  // Pour la page "ouverte dimanche", il faudrait aussi vérifier que l'un des
  // shops a effectivement un horaire dimanche, mais à ce stade (BDD test) on
  // se contente de la présence d'au moins 1 shop dans la ville.
  const shopCount = await prisma.shop.count({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
    },
  });
  const shouldNoIndex = shopCount === 0;

  const title = `Boucherie halal ouverte le dimanche à ${city.name}`;
  const description = `Trouvez les boucheries halal ouvertes le dimanche à ${city.name}. Horaires temps réel, click & collect, retrait en boutique. Klik&Go référence les boucheries halal certifiées de ${city.name}.`;
  return {
    title,
    description,
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
    keywords: [
      `boucherie halal ouverte dimanche ${city.name.toLowerCase()}`,
      `boucherie halal ${city.name.toLowerCase()} dimanche`,
      `boucherie halal dimanche ${city.name.toLowerCase()}`,
      `boucherie ouverte dimanche ${city.name.toLowerCase()}`,
      `viande halal dimanche ${city.name.toLowerCase()}`,
    ],
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/boucheries-halal-ouvertes-dimanche/${city.slug}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
      siteName: "Klik&Go",
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `${SITE_URL}/boucheries-halal-ouvertes-dimanche/${city.slug}` },
  };
}

export default async function SundayCityPage({ params }: { params: { ville: string } }) {
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!city) notFound();

  const shops = await prisma.shop.findMany({
    where: { visible: true, city: { contains: city.name, mode: "insensitive" } },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      city: true,
      description: true,
      imageUrl: true,
      rating: true,
      ratingCount: true,
      prepTimeMin: true,
      busyMode: true,
      busyExtraMin: true,
      status: true,
      phone: true,
      latitude: true,
      longitude: true,
      openingHours: true,
    },
    orderBy: { rating: "desc" },
  });

  // Filter shops open on Sunday (sun key in openingHours JSON)
  const sundayShops = shops.filter((s) => {
    const oh = s.openingHours as Record<string, { open: string; close: string } | null> | null;
    if (!oh) return false;
    const sun = oh.sun;
    return !!(sun && sun.open && sun.close);
  });

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: city.name, url: `${SITE_URL}/boucherie-halal/${city.slug}` },
          {
            name: "Ouvertes dimanche",
            url: `${SITE_URL}/boucheries-halal-ouvertes-dimanche/${city.slug}`,
          },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Boucheries halal ouvertes le dimanche à ${city.name}`,
            description: `${sundayShops.length} boucheries halal ouvertes le dimanche à ${city.name}.`,
            url: `${SITE_URL}/boucheries-halal-ouvertes-dimanche/${city.slug}`,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: sundayShops.length,
              itemListElement: sundayShops.slice(0, 20).map((s, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "Store",
                  "@id": `${SITE_URL}/boutique/${s.slug}`,
                  name: s.name,
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: s.address,
                    addressLocality: s.city,
                    addressCountry: "FR",
                  },
                  ...(s.latitude && s.longitude
                    ? {
                        geo: {
                          "@type": "GeoCoordinates",
                          latitude: s.latitude,
                          longitude: s.longitude,
                        },
                      }
                    : {}),
                  url: `${SITE_URL}/boutique/${s.slug}`,
                  ...(s.rating && s.ratingCount
                    ? {
                        aggregateRating: {
                          "@type": "AggregateRating",
                          ratingValue: s.rating,
                          reviewCount: s.ratingCount,
                        },
                      }
                    : {}),
                  openingHoursSpecification: {
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: "Sunday",
                    opens: (
                      s.openingHours as Record<string, { open: string; close: string } | null>
                    )?.sun?.open,
                    closes: (
                      s.openingHours as Record<string, { open: string; close: string } | null>
                    )?.sun?.close,
                  },
                },
              })),
            },
          }),
        }}
      />
      <section className="sr-only" aria-label="Résumé" data-purpose="ai-summary">
        <p>
          <strong>En bref :</strong> {sundayShops.length} boucherie
          {sundayShops.length > 1 ? "s" : ""} halal ouverte{sundayShops.length > 1 ? "s" : ""} le
          dimanche à {city.name} référencée
          {sundayShops.length > 1 ? "s" : ""} par Klik&amp;Go. Horaires précis, click &amp; collect
          possible, retrait en boutique au créneau choisi.
        </p>
      </section>

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-[#DC2626] via-[#b91c1c] to-[#991b1b] text-white">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5 py-14 sm:py-20">
          <Link
            href={`/boucherie-halal/${city.slug}`}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            &larr; Toutes boucheries halal {city.name}
          </Link>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Boucherie halal ouverte le dimanche à {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Trouvez les boucheries halal certifiées ouvertes le dimanche à {city.name} et son
            agglomération. Horaires précis, click &amp; collect possible, retrait en boutique sans
            file d&apos;attente.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
            <CalendarClock size={14} />
            <span>
              {sundayShops.length} boucherie{sundayShops.length > 1 ? "s" : ""} halal ouverte
              {sundayShops.length > 1 ? "s" : ""} le dimanche à {city.name}
            </span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* ── Liste boucheries ouvertes dimanche ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {sundayShops.length > 0
              ? `${sundayShops.length} boucherie${sundayShops.length > 1 ? "s" : ""} halal ouverte${sundayShops.length > 1 ? "s" : ""} le dimanche`
              : `Bientôt à ${city.name}`}
          </h2>

          {sundayShops.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {sundayShops.map((shop, idx) => (
                <ShopCard
                  key={shop.id}
                  shop={{
                    ...shop,
                    openingHours: shop.openingHours as Record<
                      string,
                      { open: string; close: string } | null
                    > | null,
                  }}
                  index={idx}
                  showFavorite={false}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#ece8e3] bg-white py-12 text-center dark:border-white/[0.06] dark:bg-gray-800">
              <CalendarClock className="mx-auto mb-3 text-gray-400" size={32} />
              <p className="mb-1 font-medium text-gray-600 dark:text-gray-300">
                Aucune boucherie partenaire ouverte le dimanche à {city.name} pour l&apos;instant
              </p>
              <p className="mx-auto mb-5 max-w-md text-sm text-gray-500 dark:text-gray-400">
                Klik&amp;Go ajoute régulièrement de nouvelles boucheries partenaires. Voici les
                autres options pour {city.name} :
              </p>
              <Link
                href={`/boucherie-halal/${city.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#DC2626] hover:underline"
              >
                Toutes les boucheries halal à {city.name} <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>

        {/* ── Pourquoi le dimanche est important ── */}
        <section className="mb-14 rounded-2xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800 sm:p-8">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            Pourquoi commander le dimanche à {city.name} ?
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              Le dimanche est traditionnellement le jour des grands repas familiaux. À {city.name},
              plusieurs boucheries halal restent ouvertes — souvent en matinée — pour vous permettre
              d&apos;acheter votre viande halal fraîche pour le déjeuner ou le dîner.
            </p>
            <p>
              Avec Klik&amp;Go, vous évitez la file d&apos;attente : commandez en ligne dès le
              samedi soir, choisissez votre créneau dimanche matin, et récupérez votre commande en
              quelques minutes. Pratique pour les réunions de famille, les méchouis, les barbecues
              d&apos;été ou simplement le gigot du dimanche.
            </p>
            <p>
              <strong>Frais de service :</strong> 0,99€ par commande. Pas d&apos;abonnement, pas de
              surcoût sur les prix des produits. Le boucher fixe ses prix, vous payez en ligne ou
              sur place.
            </p>
          </div>
        </section>

        {/* ── Autres villes dimanche ── */}
        <section className="mb-14">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            Boucherie halal ouverte dimanche dans d&apos;autres villes
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {ELIGIBLE_CITIES.filter((s) => s !== city.slug).map((slug) => {
              const c = SEO_CITIES.find((x) => x.slug === slug);
              if (!c) return null;
              return (
                <Link
                  key={slug}
                  href={`/boucheries-halal-ouvertes-dimanche/${slug}`}
                  className="block rounded-xl border border-[#ece8e3] bg-white p-3 text-center transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{c.name}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Questions fréquentes
          </h2>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: [
                  {
                    "@type": "Question",
                    name: `Quelles boucheries halal sont ouvertes le dimanche à ${city.name} ?`,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text:
                        sundayShops.length > 0
                          ? `Klik&Go référence ${sundayShops.length} boucherie${sundayShops.length > 1 ? "s" : ""} halal ouverte${sundayShops.length > 1 ? "s" : ""} le dimanche à ${city.name} : ${sundayShops.map((s) => s.name).join(", ")}.`
                          : `Klik&Go arrive bientôt à ${city.name} avec des boucheries halal ouvertes le dimanche. En attendant, consultez les autres boucheries halal partenaires.`,
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Comment commander de la viande halal le dimanche ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: `Sur Klik&Go, vous pouvez commander la veille (samedi soir) ou le matin même. Choisissez votre boucherie halal partenaire à ${city.name}, sélectionnez vos produits, payez en ligne ou sur place, et récupérez votre commande au créneau choisi le dimanche.`,
                    },
                  },
                  {
                    "@type": "Question",
                    name: `Quels sont les horaires des boucheries halal à ${city.name} le dimanche ?`,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: `Les horaires varient selon les boucheries. La plupart ouvrent en matinée (8h-13h) le dimanche. Consultez les horaires précis sur la fiche de chaque boucherie. Klik&Go affiche les horaires en temps réel.`,
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Y a-t-il un supplément pour commander le dimanche ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Non. Klik&Go facture 0,99€ de frais de service par commande, peu importe le jour. Aucun supplément le dimanche, aucun supplément les jours fériés.",
                    },
                  },
                ],
              }),
            }}
          />
          <div className="space-y-3">
            {[
              {
                q: `Quelles boucheries halal sont ouvertes le dimanche à ${city.name} ?`,
                a:
                  sundayShops.length > 0
                    ? `Klik&Go référence ${sundayShops.length} boucherie${sundayShops.length > 1 ? "s" : ""} halal ouverte${sundayShops.length > 1 ? "s" : ""} le dimanche à ${city.name}.`
                    : `Klik&Go arrive bientôt à ${city.name} avec des boucheries halal ouvertes le dimanche.`,
              },
              {
                q: "Comment commander de la viande halal le dimanche ?",
                a: `Sur Klik&Go, commandez la veille (samedi soir) ou le matin même. Choisissez, payez, récupérez au créneau choisi.`,
              },
              {
                q: `Quels sont les horaires des boucheries halal à ${city.name} le dimanche ?`,
                a: `Les horaires varient. La plupart ouvrent en matinée (8h-13h). Consultez les horaires précis sur chaque fiche.`,
              },
              {
                q: "Y a-t-il un supplément pour commander le dimanche ?",
                a: "Non. 0,99€ de frais de service par commande, peu importe le jour ou le férié.",
              },
            ].map((faq, i) => (
              <details
                key={i}
                className="group overflow-hidden rounded-xl border border-[#ece8e3] bg-white dark:border-white/[0.06] dark:bg-gray-800"
              >
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {faq.q}
                  <span className="ml-3 shrink-0 text-gray-500 transition-transform group-open:rotate-180 dark:text-gray-400">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-300">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
