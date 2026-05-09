import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Train } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import {
  SEO_DISTRICTS,
  getDistrictsByCity,
  getCityDistrictCombinations,
} from "@/lib/seo/districts";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";

const PAGE_LAST_UPDATED = "2026-05-01";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getCityDistrictCombinations();
}

export async function generateMetadata({
  params,
}: {
  params: { ville: string; quartier: string };
}): Promise<Metadata> {
  const district = SEO_DISTRICTS.find(
    (d) => d.citySlug === params.ville && d.slug === params.quartier
  );
  if (!district) return { title: "Quartier introuvable" };

  // Best practice 2026 : noindex auto si shopCount === 0 (Mars Core Update).
  const shopCount = await prisma.shop.count({
    where: {
      visible: true,
      city: { contains: district.cityName, mode: "insensitive" },
    },
  });
  const shouldNoIndex = shopCount === 0;

  const title = `Boucherie halal à ${district.name} (${district.cityName})`;
  return {
    title,
    description: district.description,
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
    keywords: [
      `boucherie halal ${district.name.toLowerCase()}`,
      `boucherie halal ${district.name.toLowerCase()} ${district.cityName.toLowerCase()}`,
      `boucherie halal quartier ${district.name.toLowerCase()}`,
    ],
    openGraph: {
      title,
      description: district.description,
      url: `${SITE_URL}/boucherie-halal/${district.citySlug}/${district.slug}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
      siteName: "Klik&Go",
    },
    twitter: { card: "summary_large_image", title, description: district.description },
    alternates: {
      canonical: `${SITE_URL}/boucherie-halal/${district.citySlug}/${district.slug}`,
    },
  };
}

export default async function DistrictPage({
  params,
}: {
  params: { ville: string; quartier: string };
}) {
  const district = SEO_DISTRICTS.find(
    (d) => d.citySlug === params.ville && d.slug === params.quartier
  );
  if (!district) notFound();

  const city = SEO_CITIES.find((c) => c.slug === district.citySlug);
  if (!city) notFound();

  // Audit Bing 2026-05-09 : implémenté le filtre district réel.
  // Heuristique : on filtre les shops de la ville par address contenant
  // (a) le code postal du quartier OU (b) le nom du quartier (case insensitive).
  // Si 0 résultat → fallback sur tous les shops de la ville (préserve l'UX et
  // évite que le crawler voie une page vide). On bump take à 12 pour les villes
  // denses comme Lyon où plusieurs quartiers ont 5+ boutiques.
  const districtShops = await prisma.shop.findMany({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
      OR: [
        ...(district.zipCode ? [{ address: { contains: district.zipCode } }] : []),
        { address: { contains: district.name, mode: "insensitive" as const } },
      ],
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
    take: 12,
  });

  const shops =
    districtShops.length > 0
      ? districtShops
      : await prisma.shop.findMany({
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

  // Signal pour l'UI : true si on liste des shops vraiment dans le quartier,
  // false si on est en mode fallback (ville entière).
  const isDistrictPrecise = districtShops.length > 0;

  const otherDistricts = getDistrictsByCity(district.citySlug).filter(
    (d) => d.slug !== district.slug
  );

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: city.name, url: `${SITE_URL}/boucherie-halal/${city.slug}` },
          { name: district.name, url: `${SITE_URL}/boucherie-halal/${city.slug}/${district.slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Place",
            name: district.name,
            description: district.description,
            url: `${SITE_URL}/boucherie-halal/${city.slug}/${district.slug}`,
            containedInPlace: {
              "@type": "City",
              name: city.name,
              url: `${SITE_URL}/boucherie-halal/${city.slug}`,
            },
            ...(district.zipCode
              ? {
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: city.name,
                    postalCode: district.zipCode,
                    addressCountry: "FR",
                  },
                }
              : {}),
          }),
        }}
      />
      <section className="sr-only" aria-label="Résumé" data-purpose="ai-summary">
        <p>
          <strong>En bref :</strong> Quartier {district.name} à {city.name} (
          {district.zipCode || city.region}).
          {district.transports?.length ? ` Accès : ${district.transports.join(", ")}.` : ""}{" "}
          Boucheries halal certifiées référencées par Klik&amp;Go. Click &amp; collect possible chez
          les partenaires, retrait au créneau choisi. Frais de service : 0,99€ par commande.
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
            Boucherie halal à {district.name}
          </h1>
          <p className="mt-2 text-lg text-white/90">
            {district.cityName}
            {district.zipCode ? ` • ${district.zipCode}` : ""}
          </p>
          <p className="mt-4 max-w-2xl text-base text-white/80">{district.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              Quartier {district.name}, {city.name}
            </span>
            {district.transports && district.transports.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Train size={14} />
                {district.transports[0]}
              </span>
            )}
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* ── Contexte quartier (E-E-A-T) ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Boucheries halal à {district.name} : présentation du quartier
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {district.context}
          </p>
          {district.transports && district.transports.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                Transports proches :
              </p>
              <div className="flex flex-wrap gap-2">
                {district.transports.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#ece8e3] bg-white px-3 py-1 text-xs text-gray-700 dark:border-white/[0.06] dark:bg-gray-800 dark:text-gray-300"
                  >
                    <Train size={11} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Liste boucheries (filtrage district précis si possible) ── */}
        <section className="mb-12">
          <h2 className="mb-2 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {isDistrictPrecise
              ? `Boucheries halal à ${district.name}`
              : `Boucheries halal ${city.name} & ${district.name}`}
          </h2>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            {isDistrictPrecise
              ? `${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal partenaire${shops.length > 1 ? "s" : ""} Klik&Go directement dans le quartier ${district.name}.`
              : `Aucune boucherie partenaire encore directement dans ${district.name} — voici les boucheries halal Klik&Go les plus proches dans ${city.name}.`}
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
              <Link
                href={`/boucherie-halal/${city.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#DC2626] hover:underline"
              >
                Voir toutes les boucheries de {city.name} <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>

        {/* ── Autres quartiers de la ville ── */}
        {otherDistricts.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
              Autres quartiers de {city.name}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {otherDistricts.map((d) => (
                <Link
                  key={d.slug}
                  href={`/boucherie-halal/${d.citySlug}/${d.slug}`}
                  className="block rounded-xl border border-[#ece8e3] bg-white p-3 text-center transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{d.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ quartier ── */}
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
                    name: `Combien de boucheries halal à ${district.name} ?`,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: `Le quartier ${district.name} à ${city.name} compte plusieurs boucheries halal certifiées. Klik&Go référence les boucheries halal partenaires de ce quartier et des environs. Consultez la liste ci-dessus pour les boucheries où vous pouvez commander en ligne.`,
                    },
                  },
                  {
                    "@type": "Question",
                    name: `Comment se rendre dans une boucherie halal à ${district.name} ?`,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: district.transports?.length
                        ? `Le quartier ${district.name} est accessible via : ${district.transports.join(", ")}. Vous pouvez aussi venir en voiture, plusieurs places de stationnement sont disponibles.`
                        : `Le quartier ${district.name} est accessible en transports en commun et en voiture.`,
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Puis-je commander en ligne et récupérer en boutique ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Oui. Avec Klik&Go, commandez votre viande halal en ligne et récupérez votre commande en boutique au créneau choisi. Pas de file d'attente, frais de service 0,99€.",
                    },
                  },
                ],
              }),
            }}
          />
          <div className="space-y-3">
            {[
              {
                q: `Combien de boucheries halal à ${district.name} ?`,
                a: `Le quartier ${district.name} à ${city.name} compte plusieurs boucheries halal certifiées. Consultez la liste ci-dessus.`,
              },
              {
                q: `Comment se rendre dans une boucherie halal à ${district.name} ?`,
                a: district.transports?.length
                  ? `Accessible via : ${district.transports.join(", ")}. Stationnement disponible.`
                  : "Accessible en transports en commun et en voiture.",
              },
              {
                q: "Puis-je commander en ligne et récupérer en boutique ?",
                a: "Oui. Commandez en ligne, récupérez sans file d'attente. Frais de service 0,99€.",
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
