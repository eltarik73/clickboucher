import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, Star, Clock, ArrowRight } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShopSchema } from "@/components/seo/ShopSchema";
import { getShopImage } from "@/lib/product-images";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

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

  const title = `Boucherie halal à ${city.name} — Click & Collect`;
  return {
    title,
    description: city.description,
    openGraph: {
      title: `${title} | Klik&Go`,
      description: city.description,
      url: `${SITE_URL}/boucherie-halal/${city.slug}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `Boucherie halal ${city.name}` }],
      siteName: "Klik&Go",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: city.description,
    },
    alternates: {
      canonical: `${SITE_URL}/boucherie-halal/${city.slug}`,
    },
  };
}

// ── Page ──
export default async function CityPage({
  params,
}: {
  params: { ville: string };
}) {
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
      phone: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { rating: "desc" },
  });

  const faqs = [
    {
      question: `Comment commander de la viande halal en ligne à ${city.name} ?`,
      answer: `Avec Klik&Go, choisissez votre boucherie halal à ${city.name}, sélectionnez vos produits, payez en ligne et récupérez votre commande en boutique au créneau choisi. Frais de service : seulement 0,99€.`,
    },
    {
      question: `Quelles boucheries halal proposent le click & collect à ${city.name} ?`,
      answer: `Klik&Go référence ${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal partenaire${shops.length > 1 ? "s" : ""} à ${city.name} et dans ${city.region === "Savoie" || city.region === "Haute-Savoie" || city.region === "Loire" ? "la " : "le "}${city.region}. Consultez notre liste ci-dessous.`,
    },
    {
      question: "La viande est-elle certifiée halal ?",
      answer:
        "Toutes les boucheries partenaires Klik&Go sont des boucheries halal vérifiées. Chaque boucher garantit la certification halal de ses produits.",
    },
    {
      question: "Quels sont les frais de commande sur Klik&Go ?",
      answer:
        "Klik&Go facture un frais de service de 0,99€ par commande. Les prix affichés sont ceux de la boucherie, sans surcoût. Pas de commission cachée sur les produits.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* ── SEO Schemas ── */}
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Boucheries", url: `${SITE_URL}/` },
          { name: city.name, url: `${SITE_URL}/boucherie-halal/${city.slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }),
        }}
      />
      {shops.map((shop) => (
        <ShopSchema key={shop.id} shop={shop} />
      ))}

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-[#DC2626] via-[#b91c1c] to-[#991b1b] text-white">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="relative max-w-4xl mx-auto px-5 py-14 sm:py-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-6 transition"
          >
            &larr; Toutes les boucheries
          </Link>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display leading-tight">
            Boucherie halal à {city.name}
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-2xl">
            {city.description}
          </p>
          <div className="flex items-center gap-2 mt-6 text-sm text-white/60">
            <MapPin size={14} />
            <span>{city.name}, {city.region} — Auvergne-Rhône-Alpes</span>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-5 py-10">
        {/* ── Comment ça marche ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 font-display">
            Comment commander en click &amp; collect à {city.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { emoji: "🔍", title: "Choisissez", desc: "Sélectionnez votre boucherie halal et vos produits" },
              { emoji: "💳", title: "Commandez", desc: "Payez en ligne ou sur place, en toute sécurité" },
              { emoji: "🛍️", title: "Récupérez", desc: "Retrait en boutique au créneau choisi" },
            ].map((step, i) => (
              <div key={i} className="text-center p-6 bg-white dark:bg-white/[0.03] rounded-2xl border border-[#ece8e3] dark:border-white/[0.06]">
                <div className="text-4xl mb-3">{step.emoji}</div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{i + 1}. {step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Boucheries list ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">
            {shops.length > 0
              ? `Nos ${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal partenaire${shops.length > 1 ? "s" : ""} à ${city.name}`
              : `Bientôt à ${city.name}`}
          </h2>

          {shops.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {shops.map((shop, idx) => {
                const effectiveTime = shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
                return (
                  <Link
                    key={shop.id}
                    href={`/boutique/${shop.slug}`}
                    className="group bg-white dark:bg-white/[0.03] rounded-2xl border border-[#ece8e3] dark:border-white/[0.06] overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="relative h-40">
                      <Image
                        src={shop.imageUrl || getShopImage(idx)}
                        alt={shop.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-white font-bold text-lg group-hover:text-[#fca5a5] transition-colors">
                          {shop.name}
                        </h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />
                          {shop.address}, {shop.city}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                          <Star size={11} className="text-yellow-500 fill-yellow-500" />
                          {shop.rating.toFixed(1)} ({shop.ratingCount})
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={11} />
                          {effectiveTime} min
                        </span>
                      </div>
                      {shop.description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">
                          {shop.description}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-white/[0.03] rounded-2xl border border-[#ece8e3] dark:border-white/[0.06]">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Klik&amp;Go arrive bientôt à {city.name}.
              </p>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group bg-white dark:bg-white/[0.03] rounded-xl border border-[#ece8e3] dark:border-white/[0.06] overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-5 py-4 font-medium text-gray-900 dark:text-white text-sm">
                  {faq.question}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform ml-3 shrink-0">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-300">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mb-14 text-center">
          <div className="bg-gradient-to-r from-[#DC2626] to-[#b91c1c] rounded-2xl p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 font-display">
              Prêt à commander ?
            </h2>
            <p className="text-white/80 mb-6">
              Découvrez toutes nos boucheries halal partenaires et commandez en quelques clics.
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-white text-[#DC2626] font-semibold rounded-full hover:bg-gray-50 transition"
            >
              Voir les boucheries
            </Link>
          </div>
        </section>

        {/* ── Other cities ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-display">
            Autres villes
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={`/boucherie-halal/${c.slug}`}
                className="px-4 py-2 bg-white dark:bg-white/[0.03] border border-[#ece8e3] dark:border-white/[0.06] rounded-full text-sm text-gray-700 dark:text-gray-300 hover:border-[#DC2626] hover:text-[#DC2626] transition"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[#ece8e3] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] py-8">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            &copy; 2026 Klik&amp;Go — Click &amp; Collect Boucherie Halal
          </p>
        </div>
      </footer>
    </div>
  );
}
