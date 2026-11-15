import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Search, Store } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { departmentCities, departmentPageContent } from "@/lib/seo/content/department";
import { FACT_SUMMARY_SHORT } from "@/lib/seo/facts";
import { REGIONAL_HUB_PATH, cityPath, departmentPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { departmentTitle } from "@/lib/seo/titles";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";
import { JsonLd } from "@/components/seo/JsonLd";

const PAGE_LAST_UPDATED = "2026-11-15";

export const revalidate = 3600;
// Closed list: a slug outside SEO_DEPARTMENTS answers 404 without running the page.
export const dynamicParams = false;

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

  const title = departmentTitle(dept);
  const url = absoluteUrl(departmentPath(dept.slug));
  return {
    title,
    description: dept.description,
    keywords: [
      `boucherie halal ${dept.name.toLowerCase()}`,
      `boucheries halal ${dept.name.toLowerCase()}`,
      ...dept.citySlugs.map((s) => `boucherie halal ${s.replace(/-/g, " ")}`),
    ],
    openGraph: {
      title,
      description: dept.description,
      url,
      images: [
        { url: "/og-image.png", width: 1200, height: 630, alt: `Boucheries halal ${dept.name}` },
      ],
      siteName: "Klik&Go",
    },
    twitter: { card: "summary_large_image", title, description: dept.description },
    alternates: { canonical: url },
  };
}

export default async function DepartmentPage({ params }: { params: { departement: string } }) {
  const dept = SEO_DEPARTMENTS.find((d) => d.slug === params.departement);
  if (!dept) notFound();

  const cities = departmentCities(dept);

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

  const content = departmentPageContent(dept, shops.length);
  const otherDepts = SEO_DEPARTMENTS.filter((d) => d.slug !== dept.slug);

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
        <div className="relative mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <Link
            href={REGIONAL_HUB_PATH}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            &larr; Toute la région
          </Link>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {content.heading}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-white/80">{dept.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {content.cities.length} villes présentées
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Store size={14} />
              {FACT_SUMMARY_SHORT}
            </span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* ── Villes du département ── */}
        <section className="mb-14">
          <h2 className="mb-2 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Villes {content.locative}
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{content.citiesIntro}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.cities.map((city) => (
              <Link
                key={city.slug}
                href={cityPath(city.slug)}
                prefetch={false}
                className="group flex items-center justify-between rounded-xl border border-[#ece8e3] bg-white p-4 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{city.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {city.districts.slice(0, 2).join(", ")}
                    {city.districts.length > 2 && ` +${city.districts.length - 2}`}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[#DC2626]"
                />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Boucheries inscrites du département ── */}
        {shops.length > 0 && (
          <section className="mb-14">
            <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
              {content.heading} sur Klik&amp;Go
            </h2>
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
          </section>
        )}

        {/* ── Contexte départemental ── */}
        <section className="mb-14 rounded-2xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800 sm:p-8">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {content.heading} : tout ce qu&apos;il faut savoir
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {dept.context}
          </p>
        </section>

        {/* ── CTA geolocator ── */}
        <section className="mb-14 rounded-2xl bg-gradient-to-br from-[#DC2626]/5 to-transparent py-8 text-center">
          <Search className="mx-auto mb-3 text-[#DC2626]" size={32} />
          <h2 className="mb-2 font-display text-xl font-bold text-gray-900 dark:text-white">
            Vous cherchez la plus proche de chez vous ?
          </h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Activez la géolocalisation et trouvez en un clic la boucherie halal la plus proche.
          </p>
          <Link
            href="/trouver-boucherie-halal"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-6 py-3 font-semibold text-white transition hover:bg-[#b91c1c]"
          >
            <MapPin size={18} />
            Trouver près de moi
          </Link>
        </section>

        {/* ── Autres départements ── */}
        <section className="mb-14">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Autres départements en Rhône-Alpes
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {otherDepts.map((d) => (
              <Link
                key={d.slug}
                href={departmentPath(d.slug)}
                className="block rounded-xl border border-[#ece8e3] bg-white p-3 text-center transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {d.citySlugs.length} villes
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ départementale ── */}
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
