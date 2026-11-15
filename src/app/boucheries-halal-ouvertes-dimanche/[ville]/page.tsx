import type { Metadata } from "next";
import { getDayHours, type OpeningHours } from "@/lib/shop-hours";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ArrowRight } from "lucide-react";
import prisma from "@/lib/prisma";
import { findSundayCity, sundayPageContent } from "@/lib/seo/content/sunday";
import { cityPath, sundayPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";
import { sundayDescription, sundayTitle } from "@/lib/seo/titles";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";
import { JsonLd } from "@/components/seo/JsonLd";

const PAGE_LAST_UPDATED = "2026-11-15";

// Sunday cities (revalidate hourly)
export const revalidate = 3600;
// Closed list: a slug outside SUNDAY_CITY_SLUGS answers 404 without running the page.
export const dynamicParams = false;

export async function generateStaticParams() {
  return SUNDAY_CITY_SLUGS.map((slug) => ({ ville: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { ville: string };
}): Promise<Metadata> {
  const city = findSundayCity(params.ville);
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

  const title = sundayTitle(city);
  const description = sundayDescription(city);
  const url = absoluteUrl(sundayPath(city.slug));
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
      url,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
      siteName: "Klik&Go",
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: url },
  };
}

export default async function SundayCityPage({ params }: { params: { ville: string } }) {
  const city = findSundayCity(params.ville);
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

  // Boutiques ouvertes le dimanche (jsDay 0) — clés françaises ou anglaises
  const sundayShops = shops.filter(
    (s) => getDayHours(s.openingHours as OpeningHours | null, 0) !== null
  );

  const content = sundayPageContent(city, sundayShops.length);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {content.jsonLd.map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

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
            href={cityPath(city.slug)}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            &larr; Toutes boucheries halal {city.name}
          </Link>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {content.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{content.intro}</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
            <CalendarClock size={14} />
            <span>{content.countLine}</span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* ── Liste boucheries ouvertes dimanche ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Boucheries halal ouvertes le dimanche à {city.name}
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
              <p className="mx-auto mb-5 max-w-md font-medium text-gray-600 dark:text-gray-300">
                {content.emptyText}
              </p>
              <Link
                href={cityPath(city.slug)}
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
            {content.editorial.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        {/* ── Autres villes dimanche ── */}
        <section className="mb-14">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            Boucherie halal ouverte dimanche dans d&apos;autres villes
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {content.otherCities.map((c) => (
              <Link
                key={c.slug}
                href={sundayPath(c.slug)}
                prefetch={false}
                className="block rounded-xl border border-[#ece8e3] bg-white p-3 text-center transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            {content.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group overflow-hidden rounded-xl border border-[#ece8e3] bg-white dark:border-white/[0.06] dark:bg-gray-800"
              >
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {faq.question}
                  <span className="ml-3 shrink-0 text-gray-500 transition-transform group-open:rotate-180 dark:text-gray-400">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-300">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
