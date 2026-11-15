import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Search, Store, Clock } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import {
  REGIONAL_HUB_DESCRIPTION,
  REGIONAL_HUB_TITLE,
  regionalHubContent,
} from "@/lib/seo/content/regional-hub";
import { FACT_SUMMARY_SHORT } from "@/lib/seo/facts";
import { REGIONAL_HUB_PATH, cityPath, departmentPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { JsonLd } from "@/components/seo/JsonLd";

const PAGE_LAST_UPDATED = "2026-11-15";

export const revalidate = 86400; // contenu éditorial + compteurs : 1 régénération / jour suffit

export const metadata: Metadata = {
  // The root title template (« %s | Klik&Go ») already adds the brand: never repeat it here.
  title: REGIONAL_HUB_TITLE,
  description: REGIONAL_HUB_DESCRIPTION,
  keywords: [
    "boucherie halal rhone alpes",
    "boucherie halal auvergne rhone alpes",
    "boucherie halal savoie",
    "boucherie halal haute savoie",
    "boucherie halal isere",
    "boucherie halal rhone",
    "boucherie halal loire",
  ],
  openGraph: {
    title: REGIONAL_HUB_TITLE,
    description: REGIONAL_HUB_DESCRIPTION,
    url: absoluteUrl(REGIONAL_HUB_PATH),
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Boucheries halal Rhône-Alpes" },
    ],
    siteName: "Klik&Go",
  },
  twitter: { card: "summary_large_image", title: REGIONAL_HUB_TITLE },
  alternates: { canonical: absoluteUrl(REGIONAL_HUB_PATH) },
};

export default async function RegionalHubPage() {
  const totalShops = await prisma.shop.count({ where: { visible: true } });
  const content = regionalHubContent(totalShops);

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
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            &larr; Accueil
          </Link>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Boucheries halal en Auvergne-Rhône-Alpes
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-white/80">{content.intro}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {SEO_CITIES.length} villes présentées
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Store size={14} />
              {content.shopCountLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              {FACT_SUMMARY_SHORT}
            </span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/trouver-boucherie-halal"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-[#DC2626] transition hover:bg-white/90"
            >
              <Search size={18} />
              Trouver près de moi
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Voir toutes les boucheries
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* ── Pages ville mises en avant ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Trouver une boucherie halal par ville
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {content.featuredCities.map((city) => (
              <Link
                key={city.slug}
                href={cityPath(city.slug)}
                prefetch={false}
                className="group block rounded-xl border border-[#ece8e3] bg-white p-4 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="mb-0.5 text-xs text-gray-500 dark:text-gray-400">{city.region}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{city.name}</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[#DC2626]"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Pages départementales ── */}
        <section className="mb-14">
          <h2 className="mb-2 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Par département
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            {SEO_DEPARTMENTS.length} départements d&apos;Auvergne-Rhône-Alpes
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.departments.map(({ department, cities }) => (
              <Link
                key={department.slug}
                href={departmentPath(department.slug)}
                prefetch={false}
                className="group block rounded-2xl border border-[#ece8e3] bg-white p-5 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">{department.name}</h3>
                  <ArrowRight
                    size={18}
                    className="mt-0.5 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-[#DC2626]"
                  />
                </div>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  {cities.length} villes présentées
                </p>
                <div className="flex flex-wrap gap-1">
                  {cities.slice(0, 4).map((c) => (
                    <span
                      key={c.slug}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {c.name}
                    </span>
                  ))}
                  {cities.length > 4 && (
                    <span className="text-[11px] text-gray-400">+{cities.length - 4}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Contenu éditorial ── */}
        <section className="mb-14 rounded-2xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800 sm:p-8">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Klik&amp;Go en Auvergne-Rhône-Alpes
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-3 text-gray-700 dark:text-gray-300">
            {content.editorial.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        {/* ── 4 piliers ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Pourquoi choisir Klik&amp;Go ?
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.pillars.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#ece8e3] bg-white p-5 dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-2 text-3xl">{item.emoji}</div>
                <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ régionale ── */}
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
