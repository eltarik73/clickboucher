import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import prisma from "@/lib/prisma";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { GeoLocator } from "./GeoLocator";
import { JsonLd } from "@/components/seo/JsonLd";
import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { COMMON_FAQ, FACT_HALAL, FACT_SUMMARY_SHORT, type Faq } from "@/lib/seo/facts";
import { faqPageJsonLd } from "@/lib/seo/jsonld/pages";
import { REGIONAL_HUB_PATH } from "@/lib/seo/routes";
import { SITE_URL, absoluteUrl } from "@/lib/seo/site";

const PAGE_URL = absoluteUrl("/trouver-boucherie-halal");
const PAGE_LAST_UPDATED = "2026-11-15";

// ISR — revalidate hourly (shop list rarely changes)
export const revalidate = 3600;

export const metadata: Metadata = {
  // Retire "— Klik&Go" du title car titleTemplate root ajoute " | Klik&Go"
  // → évite "Klik&Go | Klik&Go" doublon (audit Bing 2026-05-09 : title 75 chars).
  title: "Trouver une boucherie halal près de chez moi",
  description:
    "Trouvez une boucherie halal près de chez vous en Savoie, Haute-Savoie, Isère, Rhône ou Loire : activez la géolocalisation, puis commandez en click & collect.",
  keywords: [
    "boucherie halal près de moi",
    "boucherie halal proche",
    "boucherie halal autour de moi",
    "trouver boucherie halal",
    "boucherie halal à proximité",
    "boucherie halal ouverte maintenant",
  ],
  openGraph: {
    title: "Trouver une boucherie halal près de chez moi",
    description:
      "Géolocalisation instantanée. Trouvez votre boucherie halal la plus proche avec Klik&Go.",
    url: PAGE_URL,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Boucherie halal près de moi" },
    ],
    siteName: "Klik&Go",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trouver une boucherie halal près de chez moi",
    description: "Géolocalisation instantanée — Klik&Go.",
  },
  alternates: {
    canonical: PAGE_URL,
  },
};

const FAQS: Faq[] = [
  {
    question: "Comment trouver une boucherie halal près de chez moi ?",
    answer:
      "Activez la géolocalisation sur cette page : Klik&Go affiche les boucheries halal inscrites, triées par distance depuis votre position. Aucune installation requise, sur mobile comme sur ordinateur.",
  },
  {
    question: "Mes données de géolocalisation sont-elles enregistrées ?",
    answer:
      "Non. Votre position est utilisée uniquement dans votre navigateur pour calculer les distances vers les boucheries. Aucune donnée de localisation n'est envoyée à nos serveurs ni stockée.",
  },
  {
    question: "Quelles villes sont couvertes par Klik&Go ?",
    answer: `Klik&Go a une page pour ${SEO_CITIES.length} villes de ${SEO_DEPARTMENTS.length} départements d'Auvergne-Rhône-Alpes : ${SEO_DEPARTMENTS.map((d) => d.name).join(", ")}. Les boucheries proposées dépendent de chaque ville.`,
  },
  {
    question: "Puis-je commander en ligne chez toutes les boucheries affichées ?",
    answer:
      "Les boucheries affichées sont inscrites sur Klik&Go : vous y commandez en click & collect quand elles sont ouvertes aux commandes, puis vous retirez et payez votre commande en boutique.",
  },
  COMMON_FAQ.halal,
];

export default async function FindButcherPage() {
  const shops = await prisma.shop.findMany({
    where: { visible: true, latitude: { not: null }, longitude: { not: null } },
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

  // Convert openingHours JSON to typed shape for client
  const shopsForClient = shops.map((s) => ({
    ...s,
    openingHours: s.openingHours as Record<string, { open: string; close: string } | null> | null,
  }));

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Trouver une boucherie halal", url: PAGE_URL },
        ]}
      />
      <JsonLd data={faqPageJsonLd(FAQS)} />

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
            &larr; Accueil
          </Link>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Trouver une boucherie halal près de chez moi
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Activez la géolocalisation pour découvrir les boucheries halal les plus proches de votre
            position. Commandez en ligne ou rendez-vous directement en boutique.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
            <MapPin size={14} />
            <span>{shops.length} boucheries halal référencées en Auvergne-Rhône-Alpes</span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      {/* ── Geolocator (client component) ── */}
      <div className="mx-auto max-w-4xl px-5 py-10">
        <GeoLocator shops={shopsForClient} />
      </div>

      {/* ── Pourquoi Klik&Go ── */}
      <div className="mx-auto max-w-4xl px-5 py-10">
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Pourquoi utiliser Klik&amp;Go pour trouver une boucherie halal ?
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                emoji: "📍",
                title: "Géolocalisation",
                desc: "Les boucheries halal triées par distance depuis votre position.",
              },
              {
                emoji: "🥩",
                title: "Certification halal",
                desc: FACT_HALAL,
              },
              {
                emoji: "🛍️",
                title: "Click & Collect",
                desc: `Commandez en ligne. ${FACT_SUMMARY_SHORT}`,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#ece8e3] bg-white p-5 text-center dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-2 text-3xl">{item.emoji}</div>
                <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
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

        {/* ── Call to action ── */}
        <section className="rounded-2xl bg-gradient-to-br from-[#DC2626]/5 to-transparent py-10 text-center">
          <Search className="mx-auto mb-3 text-[#DC2626]" size={32} />
          <h2 className="mb-2 font-display text-xl font-bold text-gray-900 dark:text-white">
            Vous préférez chercher par ville ?
          </h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Consultez nos pages par département et par ville en Auvergne-Rhône-Alpes.
          </p>
          <Link
            href={REGIONAL_HUB_PATH}
            className="inline-flex items-center justify-center rounded-xl bg-[#DC2626] px-6 py-3 font-semibold text-white transition hover:bg-[#b91c1c]"
          >
            Voir toutes les boucheries
          </Link>
        </section>
      </div>
    </div>
  );
}
