import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MapPin, ChefHat, Info, type LucideIcon } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES, type SeoCity } from "@/lib/seo/cities";
import { SEO_PRODUCTS, getProductCityCombinations, type SeoProduct } from "@/lib/seo/products";
import { productCityContent, productCityHead } from "@/lib/seo/content/product-city";
import { shopCardOrderBy, shopCardSelect, toShopCards } from "@/lib/seo/shop-cards";
import { absoluteUrl } from "@/lib/seo/site";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 3600;
// Closed list: every product x city page is generated at build time, any other slug is a 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  return getProductCityCombinations();
}

type Params = { produit: string; ville: string };

function resolve(params: Params): { product: SeoProduct; city: SeoCity } {
  const product = SEO_PRODUCTS.find((p) => p.slug === params.produit);
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!product || !city) notFound();
  return { product, city };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { product, city } = resolve(params);

  // Best practice 2026 : noindex auto si shopCount === 0 (page programmatic
  // sans inventory = signal thin penalty Mars 2026 Core Update).
  const shopCount = await prisma.shop.count({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
    },
  });
  const shouldNoIndex = shopCount === 0;

  const { path, title, description } = productCityHead(product, city);
  const url = absoluteUrl(path);

  return {
    title,
    description,
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
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

const CARD =
  "rounded-2xl border border-[#ece8e3] bg-white dark:border-white/[0.06] dark:bg-gray-800";

function IconCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD} mb-12 flex items-start gap-4 p-6 sm:p-8`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/10">
        <Icon className="text-[#DC2626]" size={22} />
      </div>
      <div>
        <h2 className="mb-2 font-display text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{children}</p>
      </div>
    </section>
  );
}

export default async function ProductCityPage({ params }: { params: Params }) {
  const { product, city } = resolve(params);

  // Every listed shop of the city: the page does not know which ones sell this product.
  const rows = await prisma.shop.findMany({
    where: { visible: true, city: { contains: city.name, mode: "insensitive" } },
    select: shopCardSelect,
    orderBy: shopCardOrderBy(),
    take: 10,
  });
  const shops = await toShopCards(rows);

  const content = productCityContent(product, city, shops.length);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {content.jsonLd.map((data) => (
        <JsonLd key={String(data["@type"])} data={data} />
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
          <nav className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
            {[content.cityLink, content.departmentLink].map((link, index) => (
              <Link key={link.path} href={link.path} prefetch={false} className="hover:text-white">
                {index === 0 && "← "}
                {link.label}
              </Link>
            ))}
          </nav>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {content.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{product.shortDescription}</p>
          <p className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/60">
            <MapPin size={14} />
            {city.name}, {city.region}
          </p>
          <LastUpdated date={content.lastUpdated} className="mt-4 text-white/50" />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* ── Intro produit (contenu unique) ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {product.name} : ce qu&apos;il faut savoir
          </h2>
          <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
            {product.intro}
          </p>
        </section>

        {/* ── Boucheries de la ville ── */}
        <section className="mb-12">
          <h2 className="mb-2 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {content.shopListHeading}
          </h2>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">{content.shopListText}</p>

          {shops.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {shops.map((shop, idx) => (
                <ShopCard key={shop.id} shop={shop} index={idx} showFavorite={false} />
              ))}
            </div>
          ) : (
            <div className={`${CARD} px-5 py-10 text-center`}>
              <div className="flex flex-wrap justify-center gap-2">
                {content.otherCities.slice(0, 4).map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    prefetch={false}
                    className="rounded-full bg-[#DC2626]/10 px-3 py-1.5 text-xs font-semibold text-[#DC2626] transition hover:bg-[#DC2626]/20"
                  >
                    {product.name} à {link.label}
                  </Link>
                ))}
              </div>
              <Link
                href={content.partnerLink.path}
                prefetch={false}
                className="mt-5 inline-block text-sm font-semibold text-[#DC2626] hover:underline"
              >
                {content.partnerLink.label}
              </Link>
            </div>
          )}
        </section>

        {product.cookingTips && (
          <IconCard icon={ChefHat} title={`Conseils de cuisson — ${product.name}`}>
            {product.cookingTips}
          </IconCard>
        )}
        <IconCard icon={Info} title={`Spécialités à ${city.name}`}>
          {content.citySpecialty}
        </IconCard>

        {/* ── Autres produits ── */}
        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            Autres produits halal à {city.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {content.otherProducts.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                prefetch={false}
                className="block rounded-xl border border-[#ece8e3] bg-white p-4 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  {link.label}
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
            {content.otherCities.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                prefetch={false}
                className="block rounded-xl border border-[#ece8e3] bg-white p-3 text-center transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
              >
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{link.label}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ (même contenu que le FAQPage JSON-LD) ── */}
        <section className="mb-12">
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
