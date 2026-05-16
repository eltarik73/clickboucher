import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Calendar, Info } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import {
  SEO_OCCASIONS,
  OCCASION_VILLE_PRIORITY_SLUGS,
  getOccasionCityCombinations,
} from "@/lib/seo/occasions";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";

const PAGE_LAST_UPDATED = "2026-05-01";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getOccasionCityCombinations();
}

export async function generateMetadata({
  params,
}: {
  params: { occasion: string; ville: string };
}): Promise<Metadata> {
  const occasion = SEO_OCCASIONS.find((o) => o.slug === params.occasion);
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!occasion || !city) return { title: "Page introuvable" };

  // Pages BUSINESS-CRITICAL : Aïd al-Adha, Ramadan, mariages, etc. × villes
  // cibles = TOUJOURS index/follow. Contenu unique 6000+ mots par page (occasion
  // context + city specialty + districts + FAQ).
  //
  // Erreur 2026-05-09 à NE PLUS REFAIRE : noindex auto sur shopCount === 0
  // a fait sortir 5/6 villes SEO_CITIES de l'index Google. Cf skill
  // seo-anti-penalty + project_universal_seo_lessons.md règle #1.
  //
  // Test décisif : ≥ 500 mots de contenu unique par instance → INDEX.

  const title = `${occasion.name} halal à ${city.name} — Commander en ligne`;
  const description = `${occasion.shortDescription} Click & collect chez votre boucherie halal partenaire à ${city.name} et alentours.`;

  return {
    title,
    description,
    keywords: [
      `${occasion.keyword} ${city.name.toLowerCase()}`,
      `commander ${occasion.keyword} ${city.name.toLowerCase()}`,
      `${occasion.keyword} halal ${city.name.toLowerCase()}`,
      `${occasion.name.toLowerCase()} boucherie halal ${city.name.toLowerCase()}`,
    ],
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/occasions/${occasion.slug}/${city.slug}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
      siteName: "Klik&Go",
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `${SITE_URL}/occasions/${occasion.slug}/${city.slug}` },
  };
}

export default async function OccasionCityPage({
  params,
}: {
  params: { occasion: string; ville: string };
}) {
  const occasion = SEO_OCCASIONS.find((o) => o.slug === params.occasion);
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!occasion || !city) notFound();

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
    take: 6,
  });

  const otherCities = OCCASION_VILLE_PRIORITY_SLUGS.filter((s) => s !== city.slug)
    .map((s) => SEO_CITIES.find((c) => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => c != null);

  const otherOccasions = SEO_OCCASIONS.filter((o) => o.slug !== occasion.slug);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Occasions", url: `${SITE_URL}/occasions` },
          { name: occasion.name, url: `${SITE_URL}/occasions/${occasion.slug}` },
          { name: city.name, url: `${SITE_URL}/occasions/${occasion.slug}/${city.slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            // Schema Event uniquement si on a une vraie date fixe (Aïd, Ramadan).
            // Sinon WebPage : GSC refuse Event sans startDate (audit 2026-05-03).
            occasion.eventType && occasion.eventStart
              ? {
                  "@context": "https://schema.org",
                  "@type": occasion.eventType,
                  name: `${occasion.name} halal à ${city.name}`,
                  description: occasion.shortDescription,
                  startDate: occasion.eventStart,
                  ...(occasion.eventEnd && { endDate: occasion.eventEnd }),
                  eventStatus: "https://schema.org/EventScheduled",
                  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                  image: [`${SITE_URL}/og-image.png`],
                  location: {
                    "@type": "City",
                    name: city.name,
                    address: {
                      "@type": "PostalAddress",
                      addressLocality: city.name,
                      addressRegion: city.region,
                      addressCountry: "FR",
                    },
                  },
                  organizer: {
                    "@type": "Organization",
                    name: "Klik&Go",
                    url: SITE_URL,
                  },
                  offers: {
                    "@type": "Offer",
                    url: `${SITE_URL}/occasions/${occasion.slug}/${city.slug}`,
                    price: "0",
                    priceCurrency: "EUR",
                    availability: "https://schema.org/InStock",
                    validFrom: new Date().toISOString().split("T")[0],
                  },
                }
              : {
                  "@context": "https://schema.org",
                  "@type": "WebPage",
                  name: `${occasion.name} halal à ${city.name}`,
                  description: occasion.shortDescription,
                  url: `${SITE_URL}/occasions/${occasion.slug}/${city.slug}`,
                  inLanguage: "fr-FR",
                  isPartOf: {
                    "@type": "WebSite",
                    name: "Klik&Go",
                    url: SITE_URL,
                  },
                  about: {
                    "@type": "Place",
                    name: city.name,
                    address: {
                      "@type": "PostalAddress",
                      addressLocality: city.name,
                      addressRegion: city.region,
                      addressCountry: "FR",
                    },
                  },
                  publisher: {
                    "@type": "Organization",
                    name: "Klik&Go",
                    url: SITE_URL,
                  },
                }
          ),
        }}
      />
      <section className="sr-only" aria-label="Résumé" data-purpose="ai-summary">
        <p>
          <strong>En bref :</strong> Commandez votre {occasion.name.toLowerCase()} halal à{" "}
          {city.name} chez les boucheries partenaires Klik&amp;Go. {occasion.bookingDelay}. Click
          &amp; collect, retrait en boutique. Frais de service 0,99€.
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
            &larr; Boucheries halal {city.name}
          </Link>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {occasion.name} halal à {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{occasion.shortDescription}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {city.name}, {city.region}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {occasion.bookingDelay.split(":")[1]?.trim() || "Commander à l'avance"}
            </span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* ── Intro occasion (E-E-A-T, 250+ mots unique) ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {occasion.name} halal à {city.name} : tout ce qu&apos;il faut savoir
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {occasion.intro}
          </p>
        </section>

        {/* ── Quantité (calculatrice / serving tip) ── */}
        <section className="mb-12 rounded-2xl border border-[#DC2626]/20 bg-gradient-to-br from-[#DC2626]/5 to-transparent p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/10">
              <Info className="text-[#DC2626]" size={22} />
            </div>
            <div>
              <h3 className="mb-2 font-display text-lg font-bold text-gray-900 dark:text-white">
                {occasion.servingTip.question}
              </h3>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {occasion.servingTip.answer}
              </p>
              <p className="mt-3 text-xs font-semibold text-[#DC2626]">{occasion.bookingDelay}</p>
            </div>
          </div>
        </section>

        {/* ── Liste boucheries ── */}
        <section className="mb-12">
          <h2 className="mb-2 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {shops.length > 0
              ? `${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal pour ${occasion.name.toLowerCase()} à ${city.name}`
              : `Bientôt à ${city.name}`}
          </h2>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Demandez votre devis directement chez nos boucheries partenaires
          </p>

          {shops.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {shops.map((shop, idx) => (
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
              <p className="mb-1 font-medium text-gray-600 dark:text-gray-300">
                Klik&amp;Go arrive bientôt à {city.name}
              </p>
              <p className="mx-auto mb-5 max-w-md text-sm text-gray-500 dark:text-gray-400">
                Voir les villes voisines couvertes :
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {otherCities.slice(0, 4).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/occasions/${occasion.slug}/${c.slug}`}
                    className="rounded-full bg-[#DC2626]/10 px-3 py-1.5 text-xs font-semibold text-[#DC2626] transition hover:bg-[#DC2626]/20"
                  >
                    {occasion.name} à {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Autres occasions ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            Autres occasions à {city.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {otherOccasions.map((o) => (
              <Link
                key={o.slug}
                href={`/occasions/${o.slug}/${city.slug}`}
                className="group block rounded-xl border border-[#ece8e3] bg-white p-4 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  {o.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">à {city.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Autres villes ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            {occasion.name} dans d&apos;autres villes
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={`/occasions/${occasion.slug}/${c.slug}`}
                className="block rounded-xl border border-[#ece8e3] bg-white p-3 text-center transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-12">
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
                    name: occasion.servingTip.question,
                    acceptedAnswer: { "@type": "Answer", text: occasion.servingTip.answer },
                  },
                  {
                    "@type": "Question",
                    name: `Combien de temps à l'avance commander un ${occasion.name.toLowerCase()} halal à ${city.name} ?`,
                    acceptedAnswer: { "@type": "Answer", text: occasion.bookingDelay },
                  },
                  {
                    "@type": "Question",
                    name: `Quelle est la viande halal recommandée pour un ${occasion.name.toLowerCase()} ?`,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: `Pour un ${occasion.name.toLowerCase()}, la viande halal traditionnelle est l'agneau. Selon le nombre d'invités et le budget, vous pouvez compléter avec des merguez, brochettes, kefta, et viande hachée. Toutes nos boucheries partenaires sélectionnent leurs viandes halal certifiées auprès d'éleveurs français.`,
                    },
                  },
                ],
              }),
            }}
          />
          <div className="space-y-3">
            {[
              { q: occasion.servingTip.question, a: occasion.servingTip.answer },
              {
                q: `Combien de temps à l'avance commander un ${occasion.name.toLowerCase()} halal à ${city.name} ?`,
                a: occasion.bookingDelay,
              },
              {
                q: `Quelle est la viande halal recommandée pour un ${occasion.name.toLowerCase()} ?`,
                a: `Pour un ${occasion.name.toLowerCase()}, la viande halal traditionnelle est l'agneau. Selon vos invités et budget, complétez avec merguez, brochettes, kefta.`,
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
