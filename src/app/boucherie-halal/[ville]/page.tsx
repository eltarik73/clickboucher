import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import { cityPageContent } from "@/lib/seo/content/city";
import { ORDER_STEPS } from "@/lib/seo/facts";
import { cityPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { cityTitle } from "@/lib/seo/titles";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";
import { JsonLd } from "@/components/seo/JsonLd";

const PAGE_LAST_UPDATED = "2026-11-15";
const STEP_EMOJIS = ["🔍", "🧾", "🛍️"];

// ISR — revalidate at most once per hour. Shop list rarely changes per city,
// so a static-with-occasional-revalidation strategy is the right tradeoff
// (audit SEO HIGH #6).
export const revalidate = 3600;
// Closed list: a slug outside SEO_CITIES answers 404 without running the page.
export const dynamicParams = false;

// ── Generate static pages for each city ──
export async function generateStaticParams() {
  return SEO_CITIES.map((city) => ({ ville: city.slug }));
}

// ── Dynamic metadata ──
export async function generateMetadata({
  params,
}: {
  params: { ville: string };
}): Promise<Metadata> {
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!city) return { title: "Ville introuvable" };

  // Always indexed, even without any shop: business-critical page with unique local content
  // (rule OR of the seo-anti-penalty skill; the automatic noindex was reverted on 2026-05-10).
  const title = cityTitle(city);
  const description = city.description;
  const url = absoluteUrl(cityPath(city.slug));
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [
        { url: "/og-image.png", width: 1200, height: 630, alt: `Boucherie halal ${city.name}` },
      ],
      siteName: "Klik&Go",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

// ── Page ──
export default async function CityPage({ params }: { params: { ville: string } }) {
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!city) notFound();

  const otherCities = SEO_CITIES.filter((c) => c.slug !== city.slug);

  // Fetch shops in this city
  const shops = await prisma.shop.findMany({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
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
  });

  const content = cityPageContent(city, shops.length);

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
            href={content.departmentLink.path}
            prefetch={false}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            &larr; {content.departmentLink.label}
          </Link>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Boucherie halal à {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{city.description}</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
            <MapPin size={14} />
            <span>
              {city.name}, {city.region} — Auvergne-Rhône-Alpes
            </span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* ── Local context paragraph (audit SEO W1 — boost word count + local relevance) ── */}
        <section className="mb-14">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Boucheries halal à {city.name} : tout ce qu&apos;il faut savoir
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {city.localContext}
          </p>
          {city.specialty && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-800 dark:text-gray-200">
                Spécialités appréciées à {city.name} :
              </strong>{" "}
              {city.specialty}.
            </p>
          )}
          {city.districts.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                Quartiers et communes à proximité :
              </p>
              <div className="flex flex-wrap gap-2">
                {city.districts.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center rounded-full border border-[#ece8e3] bg-white px-3 py-1 text-xs text-gray-700 dark:border-white/[0.06] dark:bg-gray-800 dark:text-gray-300"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Comment ça marche ── */}
        <section className="mb-14">
          <h2 className="mb-8 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Comment commander en click &amp; collect à {city.name}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {ORDER_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-[#ece8e3] bg-white p-6 text-center dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-3 text-4xl">{STEP_EMOJIS[i]}</div>
                <h3 className="mb-1 font-bold text-gray-900 dark:text-white">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Boucheries list ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Boucheries halal à {city.name} sur Klik&amp;Go
          </h2>

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
              <p className="mb-4 text-gray-500 dark:text-gray-400">{content.emptyText}</p>
              <Link
                href="/espace-boucher"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#DC2626] hover:underline"
              >
                Vous êtes boucher ? Devenez partenaire <ArrowRight size={14} />
              </Link>
            </div>
          )}
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

        {/* ── CTA ── */}
        <section className="mb-14 text-center">
          <div className="rounded-2xl bg-gradient-to-r from-[#DC2626] to-[#b91c1c] p-8 sm:p-12">
            <h2 className="mb-3 font-display text-2xl font-bold text-white sm:text-3xl">
              Prêt à commander ?
            </h2>
            <p className="mb-6 text-white/80">
              Découvrez les boucheries halal inscrites sur Klik&amp;Go et commandez en click &amp;
              collect.
            </p>
            <Link
              href="/"
              className="inline-block rounded-full bg-white px-8 py-3 font-semibold text-[#DC2626] transition hover:bg-gray-50 dark:bg-gray-900"
            >
              Voir les boucheries
            </Link>
          </div>
        </section>

        {/* ── B2B CTA — Boucher acquisition cross-link ── */}
        <section className="mb-14">
          <Link
            href={`/devenir-boucher-partenaire/${city.slug}`}
            className="group block rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 transition-all hover:border-[#DC2626]/40 sm:p-8"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-[#FCA5A5]">
                  Vous êtes boucher à {city.name} ?
                </p>
                <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
                  Rejoignez Klik&amp;Go &mdash;{" "}
                  <span className="font-serif font-normal italic text-[#FCA5A5]">100% gratuit</span>
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  Aucun abonnement, commission uniquement. Vitrine en ligne, mode cuisine, fidélité
                  &mdash; en 24h.
                </p>
              </div>
              <ArrowRight
                size={28}
                className="shrink-0 text-[#DC2626] transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>
        </section>

        {/* ── Other cities ── */}
        <section className="mb-10">
          <h2 className="mb-4 font-display text-lg font-bold text-gray-900 dark:text-white">
            Autres villes
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={cityPath(c.slug)}
                prefetch={false}
                className="rounded-full border border-[#ece8e3] bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-[#DC2626] hover:text-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800 dark:text-gray-300"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <Link
            href={content.regionalHubLink.path}
            prefetch={false}
            className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#DC2626] hover:underline"
          >
            {content.regionalHubLink.label} <ArrowRight size={14} />
          </Link>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[#ece8e3] bg-white py-8 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Klik&amp;Go — Click &amp; Collect Boucherie Halal
          </p>
        </div>
      </footer>
    </div>
  );
}
