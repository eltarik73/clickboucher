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
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": occasion.eventType,
            name: `${occasion.name} halal à ${city.name}`,
            description: occasion.shortDescription,
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
          }),
        }}
      />
      <section className="sr-only" aria-label="Résumé" data-purpose="ai-summary">
        <p>
          <strong>En bref :</strong> Commandez votre {occasion.name.toLowerCase()} halal à {city.name} chez les
          boucheries partenaires Klik&amp;Go. {occasion.bookingDelay}. Click &amp; collect, retrait en boutique.
          Frais de service 0,99€.
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
        <div className="relative max-w-4xl mx-auto px-5 py-14 sm:py-20">
          <Link
            href={`/boucherie-halal/${city.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-6 transition"
          >
            &larr; Boucheries halal {city.name}
          </Link>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display leading-tight">
            {occasion.name} halal à {city.name}
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-2xl">{occasion.shortDescription}</p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-sm text-white/60">
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

      <div className="max-w-4xl mx-auto px-5 py-10">
        {/* ── Intro occasion (E-E-A-T, 250+ mots unique) ── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-display">
            {occasion.name} halal à {city.name} : tout ce qu&apos;il faut savoir
          </h2>
          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">{occasion.intro}</p>
        </section>

        {/* ── Quantité (calculatrice / serving tip) ── */}
        <section className="mb-12 bg-gradient-to-br from-[#DC2626]/5 to-transparent rounded-2xl p-6 sm:p-8 border border-[#DC2626]/20">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
              <Info className="text-[#DC2626]" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-display">
                {occasion.servingTip.question}
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {occasion.servingTip.answer}
              </p>
              <p className="mt-3 text-xs text-[#DC2626] font-semibold">{occasion.bookingDelay}</p>
            </div>
          </div>
        </section>

        {/* ── Liste boucheries ── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-display">
            {shops.length > 0
              ? `${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal pour ${occasion.name.toLowerCase()} à ${city.name}`
              : `Bientôt à ${city.name}`}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Demandez votre devis directement chez nos boucheries partenaires
          </p>

          {shops.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-[#ece8e3] dark:border-white/[0.06]">
              <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">
                Klik&amp;Go arrive bientôt à {city.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-md mx-auto">
                Voir les villes voisines couvertes :
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {otherCities.slice(0, 4).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/occasions/${occasion.slug}/${c.slug}`}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#DC2626]/10 text-[#DC2626] font-semibold hover:bg-[#DC2626]/20 transition"
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 font-display">
            Autres occasions à {city.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {otherOccasions.map((o) => (
              <Link
                key={o.slug}
                href={`/occasions/${o.slug}/${city.slug}`}
                className="group block p-4 bg-white dark:bg-gray-800 rounded-xl border border-[#ece8e3] dark:border-white/[0.06] hover:border-[#DC2626] hover:shadow-md transition"
              >
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5">{o.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">à {city.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Autres villes ── */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 font-display">
            {occasion.name} dans d&apos;autres villes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={`/occasions/${occasion.slug}/${c.slug}`}
                className="block p-3 bg-white dark:bg-gray-800 rounded-xl border border-[#ece8e3] dark:border-white/[0.06] hover:border-[#DC2626] transition text-center"
              >
                <p className="font-semibold text-gray-900 dark:text-white text-xs">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">
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
                className="group bg-white dark:bg-gray-800 rounded-xl border border-[#ece8e3] dark:border-white/[0.06] overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-5 py-4 font-medium text-gray-900 dark:text-white text-sm">
                  {faq.q}
                  <span className="text-gray-500 dark:text-gray-400 group-open:rotate-180 transition-transform ml-3 shrink-0">
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
