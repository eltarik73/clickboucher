import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShopSchema } from "@/components/seo/ShopSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { ShopCard } from "@/components/shop/ShopCard";

const PAGE_LAST_UPDATED = "2026-05-01";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// ISR — revalidate at most once per hour. Shop list rarely changes per city,
// so a static-with-occasional-revalidation strategy is the right tradeoff
// (audit SEO HIGH #6).
export const revalidate = 3600;

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

  // Compte les shops actifs dans la ville. Si 0 → noindex.
  // Justification (audit GSC mai 2026 + Google Mars 2026 Core Update) :
  // les marketplaces qui exposent des "category pages" sans inventaire
  // (cf SEORAF Programmatic SEO 2026, JourneyH Marketplace Playbook,
  // Metaflow scaled-content guidance) sont penalisées : Google les classe
  // "Explorée non indexée" et le bruit thin pénalise le ranking global du
  // domaine. Stratégie correcte : noindex tant que shopCount === 0,
  // flip à index dès qu'un boucher s'inscrit. La page reste accessible
  // (URL valide, contenu utile pour acquisition boucher direct), elle
  // n'est juste pas pushée à Google tant qu'elle n'apporte pas de valeur
  // marketplace réelle.
  const shopCount = await prisma.shop.count({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
    },
  });
  const shouldNoIndex = shopCount === 0;

  // Title hook : "Commande en ligne 30min" ajoute un délai concret —
  // facteur déterminant du clic mobile (audit GSC CTR mai 2026).
  // Le suffixe " | Klik&Go" est ajouté automatiquement par le titleTemplate
  // du layout racine — ne PAS le dupliquer ici.
  const title = `Boucherie halal ${city.name} — Commande en ligne 30min`;
  const description = city.description;
  return {
    title,
    description,
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/boucherie-halal/${city.slug}`,
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
    alternates: {
      canonical: `${SITE_URL}/boucherie-halal/${city.slug}`,
    },
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

  const faqs = [
    {
      question: `Comment commander de la viande halal en ligne à ${city.name} ?`,
      answer: `Avec Klik&Go, choisissez votre boucherie halal à ${city.name}, sélectionnez vos produits, payez en ligne et récupérez votre commande en boutique au créneau choisi. Frais de service : seulement 0,99€.`,
    },
    {
      question: `Quelles boucheries halal proposent le click & collect à ${city.name} ?`,
      answer:
        shops.length > 0
          ? `Klik&Go référence ${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal partenaire${shops.length > 1 ? "s" : ""} à ${city.name} et dans ${city.region === "Savoie" || city.region === "Haute-Savoie" || city.region === "Loire" ? "la " : "le "}${city.region}. Consultez notre liste ci-dessous.`
          : `Klik&Go arrive bientôt à ${city.name}. Nous recrutons actuellement des boucheries halal partenaires dans ${city.region === "Savoie" || city.region === "Haute-Savoie" || city.region === "Loire" ? "la " : "le "}${city.region}. Si vous êtes boucher, contactez-nous pour rejoindre la plateforme.`,
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
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5 py-14 sm:py-20">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            &larr; Toutes les boucheries
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
                Quartiers et communes desservis :
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
            {[
              {
                emoji: "🔍",
                title: "Choisissez",
                desc: "Sélectionnez votre boucherie halal et vos produits",
              },
              {
                emoji: "💳",
                title: "Commandez",
                desc: "Payez en ligne ou sur place, en toute sécurité",
              },
              { emoji: "🛍️", title: "Récupérez", desc: "Retrait en boutique au créneau choisi" },
            ].map((step, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#ece8e3] bg-white p-6 text-center dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-3 text-4xl">{step.emoji}</div>
                <h3 className="mb-1 font-bold text-gray-900 dark:text-white">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Boucheries list ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            {shops.length > 0
              ? `Nos ${shops.length} boucherie${shops.length > 1 ? "s" : ""} halal partenaire${shops.length > 1 ? "s" : ""} à ${city.name}`
              : `Bientôt à ${city.name}`}
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
              <p className="mb-4 text-gray-500 dark:text-gray-400">
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
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details
                key={i}
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
              Découvrez toutes nos boucheries halal partenaires et commandez en quelques clics.
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
                href={`/boucherie-halal/${c.slug}`}
                className="rounded-full border border-[#ece8e3] bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-[#DC2626] hover:text-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800 dark:text-gray-300"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[#ece8e3] bg-white py-8 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; 2026 Klik&amp;Go — Click &amp; Collect Boucherie Halal
          </p>
        </div>
      </footer>
    </div>
  );
}
