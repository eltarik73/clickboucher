import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Search } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_DEPARTMENTS, SEO_CITIES } from "@/lib/seo/cities";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";

const PAGE_LAST_UPDATED = "2026-05-01";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const revalidate = 3600;

export async function generateStaticParams() {
  return SEO_DEPARTMENTS.map((d) => ({ departement: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { departement: string };
}): Promise<Metadata> {
  const dept = SEO_DEPARTMENTS.find((d) => d.slug === params.departement);
  if (!dept) return { title: "Département introuvable" };

  const title = `Boucheries halal en ${dept.name} — Annuaire ${dept.citySlugs.length} villes`;
  return {
    title,
    description: dept.description,
    keywords: [
      `boucherie halal ${dept.name.toLowerCase()}`,
      `boucheries halal ${dept.name.toLowerCase()}`,
      `annuaire boucherie halal ${dept.name.toLowerCase()}`,
      ...dept.citySlugs.map((s) => `boucherie halal ${s.replace(/-/g, " ")}`),
    ],
    openGraph: {
      title,
      description: dept.description,
      url: `${SITE_URL}/boucheries-halal/${dept.slug}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `Boucheries halal ${dept.name}` }],
      siteName: "Klik&Go",
    },
    twitter: { card: "summary_large_image", title, description: dept.description },
    alternates: { canonical: `${SITE_URL}/boucheries-halal/${dept.slug}` },
  };
}

export default async function DepartmentPage({
  params,
}: {
  params: { departement: string };
}) {
  const dept = SEO_DEPARTMENTS.find((d) => d.slug === params.departement);
  if (!dept) notFound();

  const cities = SEO_CITIES.filter((c) => dept.citySlugs.includes(c.slug));

  // Fetch top shops in the department's cities
  const shops = await prisma.shop.findMany({
    where: {
      visible: true,
      OR: cities.map((c) => ({ city: { contains: c.name, mode: "insensitive" as const } })),
    },
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
    take: 10,
  });

  const otherDepts = SEO_DEPARTMENTS.filter((d) => d.slug !== dept.slug);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Boucheries halal Rhône-Alpes", url: `${SITE_URL}/boucheries-halal-rhone-alpes` },
          { name: dept.name, url: `${SITE_URL}/boucheries-halal/${dept.slug}` },
        ]}
      />
      {/* CollectionPage + ItemList of cities */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Boucheries halal en ${dept.name}`,
            description: dept.description,
            url: `${SITE_URL}/boucheries-halal/${dept.slug}`,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: cities.length,
              itemListElement: cities.map((city, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "Place",
                  name: `Boucheries halal à ${city.name}`,
                  url: `${SITE_URL}/boucherie-halal/${city.slug}`,
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: city.name,
                    addressRegion: city.region,
                    addressCountry: "FR",
                  },
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: city.latitude,
                    longitude: city.longitude,
                  },
                },
              })),
            },
          }),
        }}
      />
      <section className="sr-only" aria-label="Résumé" data-purpose="ai-summary">
        <p>
          <strong>En bref :</strong> Klik&amp;Go référence {cities.length} villes avec boucheries halal certifiées
          en {dept.name} ({dept.region}). {cities.map((c) => c.name).join(", ")}. Commande en ligne possible chez
          les boucheries partenaires, retrait en boutique au créneau choisi. Frais de service : 0,99€ par commande.
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
        <div className="relative max-w-5xl mx-auto px-5 py-14 sm:py-20">
          <Link
            href="/boucheries-halal-rhone-alpes"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-6 transition"
          >
            &larr; Toute la région
          </Link>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display leading-tight">
            Boucheries halal en {dept.name}
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-3xl">{dept.description}</p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {cities.length} villes référencées
            </span>
            <span className="inline-flex items-center gap-1.5">
              {shops.length} boucherie{shops.length > 1 ? "s" : ""} partenaire{shops.length > 1 ? "s" : ""}
            </span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 py-10">
        {/* ── Villes du département ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-display">
            Toutes les villes du département
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            {cities.length} villes avec boucheries halal référencées
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cities.map((city) => (
              <Link
                key={city.slug}
                href={`/boucherie-halal/${city.slug}`}
                className="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-[#ece8e3] dark:border-white/[0.06] hover:border-[#DC2626] hover:shadow-md transition"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{city.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {city.districts.slice(0, 2).join(", ")}
                    {city.districts.length > 2 && ` +${city.districts.length - 2}`}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-gray-400 group-hover:text-[#DC2626] group-hover:translate-x-0.5 transition shrink-0"
                />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Top boucheries du département ── */}
        {shops.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">
              Top {shops.length} boucherie{shops.length > 1 ? "s" : ""} halal en {dept.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {shops.map((shop, idx) => (
                <ShopCard
                  key={shop.id}
                  shop={{
                    ...shop,
                    openingHours: shop.openingHours as Record<string, { open: string; close: string } | null> | null,
                  }}
                  index={idx}
                  showFavorite={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Contexte départemental ── */}
        <section className="mb-14 bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 border border-[#ece8e3] dark:border-white/[0.06]">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-display">
            Boucheries halal en {dept.name} — tout ce qu&apos;il faut savoir
          </h2>
          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">{dept.context}</p>
        </section>

        {/* ── CTA geolocator ── */}
        <section className="mb-14 text-center py-8 bg-gradient-to-br from-[#DC2626]/5 to-transparent rounded-2xl">
          <Search className="mx-auto mb-3 text-[#DC2626]" size={32} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-display">
            Vous cherchez la plus proche de chez vous ?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5 max-w-md mx-auto">
            Activez la géolocalisation et trouvez en un clic la boucherie halal la plus proche.
          </p>
          <Link
            href="/trouver-boucherie-halal"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#DC2626] text-white rounded-xl font-semibold hover:bg-[#b91c1c] transition"
          >
            <MapPin size={18} />
            Trouver près de moi
          </Link>
        </section>

        {/* ── Autres départements ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-display">
            Autres départements en Rhône-Alpes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {otherDepts.map((d) => (
              <Link
                key={d.slug}
                href={`/boucheries-halal/${d.slug}`}
                className="block p-3 bg-white dark:bg-gray-800 rounded-xl border border-[#ece8e3] dark:border-white/[0.06] hover:border-[#DC2626] transition text-center"
              >
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{d.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{d.citySlugs.length} villes</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ départementale ── */}
        <section className="mb-14">
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
                    name: `Combien de boucheries halal partenaires Klik&Go en ${dept.name} ?`,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: `Klik&Go référence des boucheries halal certifiées dans ${cities.length} villes en ${dept.name} : ${cities.map((c) => c.name).join(", ")}.`,
                    },
                  },
                  {
                    "@type": "Question",
                    name: `Comment commander de la viande halal en ligne en ${dept.name} ?`,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Choisissez votre ville, sélectionnez une boucherie halal partenaire, ajoutez vos produits au panier, payez en ligne ou sur place, et récupérez votre commande en boutique au créneau choisi. Frais de service : 0,99€ par commande.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Toutes les boucheries listées sont-elles certifiées halal ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Oui. Toutes les boucheries partenaires Klik&Go sont des boucheries halal vérifiées. Chaque boucher garantit la certification halal de ses produits.",
                    },
                  },
                ],
              }),
            }}
          />
          <div className="space-y-3">
            {[
              {
                q: `Combien de boucheries halal partenaires Klik&Go en ${dept.name} ?`,
                a: `Klik&Go référence des boucheries halal certifiées dans ${cities.length} villes en ${dept.name} : ${cities.map((c) => c.name).join(", ")}.`,
              },
              {
                q: `Comment commander de la viande halal en ligne en ${dept.name} ?`,
                a: "Choisissez votre ville, sélectionnez une boucherie halal partenaire, ajoutez vos produits au panier, payez en ligne ou sur place, et récupérez votre commande en boutique au créneau choisi.",
              },
              {
                q: "Toutes les boucheries listées sont-elles certifiées halal ?",
                a: "Oui. Toutes les boucheries partenaires Klik&Go sont des boucheries halal vérifiées.",
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
