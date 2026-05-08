import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, ChefHat, Info } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import {
  SEO_PRODUCTS,
  PRODUCT_VILLE_PRIORITY_SLUGS,
  getProductCityCombinations,
} from "@/lib/seo/products";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";

const PAGE_LAST_UPDATED = "2026-05-01";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getProductCityCombinations();
}

export async function generateMetadata({
  params,
}: {
  params: { produit: string; ville: string };
}): Promise<Metadata> {
  const product = SEO_PRODUCTS.find((p) => p.slug === params.produit);
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!product || !city) return { title: "Page introuvable" };

  // Best practice 2026 : noindex auto si shopCount === 0 (page programmatic
  // sans inventory = signal thin penalty Mars 2026 Core Update).
  const shopCount = await prisma.shop.count({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
    },
  });
  const shouldNoIndex = shopCount === 0;

  const title = `${product.name} à ${city.name} — Click & Collect`;
  const description = `${product.shortDescription} Trouvez les meilleurs ${product.pluralKeyword} à ${city.name}. Commande en ligne, retrait en boutique chez votre boucherie halal partenaire Klik&Go.`;

  return {
    title,
    description,
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
    keywords: [
      `${product.keyword} ${city.name.toLowerCase()}`,
      `${product.pluralKeyword} ${city.name.toLowerCase()}`,
      `acheter ${product.keyword} ${city.name.toLowerCase()}`,
      `commander ${product.keyword} ${city.name.toLowerCase()}`,
      `${product.keyword} halal ${city.name.toLowerCase()}`,
    ],
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/produits/${product.slug}/${city.slug}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
      siteName: "Klik&Go",
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `${SITE_URL}/produits/${product.slug}/${city.slug}` },
  };
}

export default async function ProductCityPage({
  params,
}: {
  params: { produit: string; ville: string };
}) {
  const product = SEO_PRODUCTS.find((p) => p.slug === params.produit);
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!product || !city) notFound();

  // Fetch all shops in this city (we don't yet filter by product availability,
  // but the page lists shops where users can find the product)
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
    take: 10,
  });

  const otherCities = PRODUCT_VILLE_PRIORITY_SLUGS.filter((s) => s !== city.slug)
    .map((s) => SEO_CITIES.find((c) => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => c != null);

  const otherProducts = SEO_PRODUCTS.filter((p) => p.slug !== product.slug).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Produits halal", url: `${SITE_URL}/produits` },
          { name: product.name, url: `${SITE_URL}/produits/${product.slug}` },
          { name: city.name, url: `${SITE_URL}/produits/${product.slug}/${city.slug}` },
        ]}
      />
      {/* Schema Product + Offer + ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${product.name} à ${city.name}`,
            description: product.shortDescription,
            image: `${SITE_URL}/og-image.png`,
            category: product.category,
            brand: { "@type": "Brand", name: "Klik&Go" },
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "EUR",
              availability:
                shops.length > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              offerCount: shops.length,
              areaServed: { "@type": "City", name: city.name },
            },
          }),
        }}
      />
      <section className="sr-only" aria-label="Résumé" data-purpose="ai-summary">
        <p>
          <strong>En bref :</strong> {product.shortDescription} Disponible chez {shops.length}{" "}
          boucherie
          {shops.length > 1 ? "s" : ""} halal partenaire{shops.length > 1 ? "s" : ""} Klik&amp;Go à{" "}
          {city.name}({city.region}). Commande en ligne, paiement en ligne ou sur place, retrait en
          boutique au créneau choisi. Frais de service : 0,99€ par commande.
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
            {product.name} à {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{product.shortDescription}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {city.name}, {city.region}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {shops.length} boucherie{shops.length > 1 ? "s" : ""} partenaire
              {shops.length > 1 ? "s" : ""}
            </span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* ── Intro produit (250+ mots, contenu unique) ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {product.name} : ce qu&apos;il faut savoir
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {product.intro}
          </p>
        </section>

        {/* ── Liste boucheries qui vendent ce produit à cette ville ── */}
        <section className="mb-12">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {shops.length > 0
              ? `${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal à ${city.name}`
              : `Bientôt à ${city.name}`}
          </h2>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Commandez votre {product.name.toLowerCase()} directement chez nos boucheries partenaires
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
                Nous recrutons activement des boucheries halal partenaires à {city.name}. En
                attendant, voici les villes proches couvertes :
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {otherCities.slice(0, 4).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/produits/${product.slug}/${c.slug}`}
                    className="rounded-full bg-[#DC2626]/10 px-3 py-1.5 text-xs font-semibold text-[#DC2626] transition hover:bg-[#DC2626]/20"
                  >
                    {product.name} à {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Conseils cuisson (E-E-A-T) ── */}
        {product.cookingTips && (
          <section className="mb-12 rounded-2xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/10">
                <ChefHat className="text-[#DC2626]" size={22} />
              </div>
              <div>
                <h2 className="mb-2 font-display text-xl font-bold text-gray-900 dark:text-white">
                  Conseils de cuisson — {product.name}
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {product.cookingTips}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Spécialité ville (utilise SEO_CITIES.specialty) ── */}
        {city.specialty && (
          <section className="mb-12 rounded-2xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/10">
                <Info className="text-[#DC2626]" size={22} />
              </div>
              <div>
                <h2 className="mb-2 font-display text-xl font-bold text-gray-900 dark:text-white">
                  Spécialités viande à {city.name}
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {city.specialty}.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Autres produits ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            Autres produits halal à {city.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {otherProducts.map((p) => (
              <Link
                key={p.slug}
                href={`/produits/${p.slug}/${city.slug}`}
                className="group block rounded-xl border border-[#ece8e3] bg-white p-4 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  {p.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">à {city.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Autres villes pour ce produit ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            {product.name} dans d&apos;autres villes
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={`/produits/${product.slug}/${c.slug}`}
                className="block rounded-xl border border-[#ece8e3] bg-white p-3 text-center transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        {product.servingQuestion && (
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
                      name: product.servingQuestion.question,
                      acceptedAnswer: { "@type": "Answer", text: product.servingQuestion.answer },
                    },
                    {
                      "@type": "Question",
                      name: `Où acheter du ${product.keyword} à ${city.name} ?`,
                      acceptedAnswer: {
                        "@type": "Answer",
                        text:
                          shops.length > 0
                            ? `Klik&Go référence ${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal partenaire${shops.length > 1 ? "s" : ""} à ${city.name} où vous pouvez commander votre ${product.keyword}. Commande en ligne, retrait en boutique au créneau choisi, frais de service 0,99€.`
                            : `Klik&Go arrive bientôt à ${city.name}. En attendant, vous pouvez commander dans les villes voisines couvertes par notre réseau.`,
                      },
                    },
                    {
                      "@type": "Question",
                      name: `Le ${product.keyword} est-il certifié halal ?`,
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: `Oui. Toutes les boucheries partenaires Klik&Go sont des boucheries halal vérifiées. Chaque boucher garantit la certification halal de ses produits, dont le ${product.keyword}.`,
                      },
                    },
                  ],
                }),
              }}
            />
            <div className="space-y-3">
              {[
                {
                  q: product.servingQuestion.question,
                  a: product.servingQuestion.answer,
                },
                {
                  q: `Où acheter du ${product.keyword} à ${city.name} ?`,
                  a:
                    shops.length > 0
                      ? `Klik&Go référence ${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal partenaire${shops.length > 1 ? "s" : ""} à ${city.name}. Commande en ligne, retrait en boutique au créneau choisi.`
                      : `Klik&Go arrive bientôt à ${city.name}. Voir les villes voisines couvertes.`,
                },
                {
                  q: `Le ${product.keyword} est-il certifié halal ?`,
                  a: `Oui. Toutes les boucheries partenaires Klik&Go sont halal certifiées.`,
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
        )}
      </div>
    </div>
  );
}
