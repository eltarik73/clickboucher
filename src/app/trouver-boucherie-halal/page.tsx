import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import prisma from "@/lib/prisma";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { GeoLocator } from "./GeoLocator";

const PAGE_LAST_UPDATED = "2026-05-01";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// ISR — revalidate hourly (shop list rarely changes)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Trouver une boucherie halal près de chez moi — Klik&Go",
  description:
    "Trouvez la boucherie halal la plus proche de chez vous en Auvergne-Rhône-Alpes. Géolocalisation instantanée, filtres ouverte maintenant, click & collect possible. Plus de 50 boucheries halal référencées.",
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
    url: `${SITE_URL}/trouver-boucherie-halal`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Boucherie halal près de moi" }],
    siteName: "Klik&Go",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trouver une boucherie halal près de chez moi",
    description: "Géolocalisation instantanée — Klik&Go.",
  },
  alternates: {
    canonical: `${SITE_URL}/trouver-boucherie-halal`,
  },
};

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
          { name: "Trouver une boucherie halal", url: `${SITE_URL}/trouver-boucherie-halal` },
        ]}
      />
      {/* Schema WebSite + SearchAction (sitelinks searchbox) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            url: SITE_URL,
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${SITE_URL}/recherche?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
      {/* TLDR for AI parsers (GPTBot, ClaudeBot, PerplexityBot) */}
      <section
        className="sr-only"
        aria-label="Résumé"
        data-purpose="ai-summary"
      >
        <p>
          <strong>En bref :</strong> Klik&amp;Go référence les boucheries halal certifiées en Auvergne-Rhône-Alpes
          (Savoie, Haute-Savoie, Isère, Rhône, Loire). Activez la géolocalisation pour trouver les boucheries halal
          les plus proches de votre position. Commande en ligne possible chez les boucheries partenaires, retrait en
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
        <div className="relative max-w-4xl mx-auto px-5 py-14 sm:py-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-6 transition"
          >
            &larr; Accueil
          </Link>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display leading-tight">
            Trouver une boucherie halal près de chez moi
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-2xl">
            Activez la géolocalisation pour découvrir les boucheries halal certifiées les plus proches de votre
            position. Commandez en ligne ou rendez-vous directement en boutique.
          </p>
          <div className="flex items-center gap-2 mt-6 text-sm text-white/60">
            <MapPin size={14} />
            <span>{shops.length} boucheries halal référencées en Auvergne-Rhône-Alpes</span>
          </div>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/50" />
        </div>
      </section>

      {/* ── Geolocator (client component) ── */}
      <div className="max-w-4xl mx-auto px-5 py-10">
        <GeoLocator shops={shopsForClient} />
      </div>

      {/* ── Pourquoi Klik&Go ── */}
      <div className="max-w-4xl mx-auto px-5 py-10">
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">
            Pourquoi utiliser Klik&amp;Go pour trouver une boucherie halal ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                emoji: "📍",
                title: "Géolocalisation",
                desc: "Vos boucheries halal triées par distance, en temps réel.",
              },
              {
                emoji: "✅",
                title: "Halal certifié",
                desc: "Toutes nos boucheries partenaires sont vérifiées halal.",
              },
              {
                emoji: "🛍️",
                title: "Click & Collect",
                desc: "Commandez en ligne, retirez en boutique, sans file d'attente.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-[#ece8e3] dark:border-white/[0.06] text-center"
              >
                <div className="text-3xl mb-2">{item.emoji}</div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">
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
                    name: "Comment trouver une boucherie halal près de chez moi ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Activez la géolocalisation sur cette page. Klik&Go affiche instantanément les boucheries halal certifiées triées par distance depuis votre position. Aucune installation requise, fonctionne sur mobile et desktop.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Mes données de géolocalisation sont-elles enregistrées ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Non. Votre position est utilisée uniquement dans votre navigateur pour calculer les distances vers les boucheries. Aucune donnée de localisation n'est envoyée à nos serveurs ni stockée.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Quelles villes sont couvertes par Klik&Go ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Klik&Go couvre Auvergne-Rhône-Alpes : Savoie (Chambéry, Aix-les-Bains, Albertville), Haute-Savoie (Annecy, Annemasse, Thonon, Cluses), Isère (Grenoble, Échirolles, Voiron, Bourgoin-Jallieu), Rhône (Lyon, Villeurbanne, Vénissieux, Vaulx-en-Velin, Bron), Loire (Saint-Étienne, Roanne, Firminy).",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Puis-je commander en ligne chez toutes les boucheries affichées ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Vous pouvez commander en ligne chez les boucheries partenaires Klik&Go (badge Click & Collect). Pour les autres boucheries référencées dans notre annuaire, vous pouvez consulter leurs coordonnées et les contacter directement.",
                    },
                  },
                ],
              }),
            }}
          />
          <div className="space-y-3">
            {[
              {
                q: "Comment trouver une boucherie halal près de chez moi ?",
                a: "Activez la géolocalisation sur cette page. Klik&Go affiche instantanément les boucheries halal certifiées triées par distance depuis votre position. Aucune installation requise, fonctionne sur mobile et desktop.",
              },
              {
                q: "Mes données de géolocalisation sont-elles enregistrées ?",
                a: "Non. Votre position est utilisée uniquement dans votre navigateur pour calculer les distances vers les boucheries. Aucune donnée de localisation n'est envoyée à nos serveurs ni stockée.",
              },
              {
                q: "Quelles villes sont couvertes par Klik&Go ?",
                a: "Klik&Go couvre toute l'Auvergne-Rhône-Alpes : Savoie, Haute-Savoie, Isère, Rhône, Loire — soit plus de 30 villes principales et leurs quartiers.",
              },
              {
                q: "Puis-je commander en ligne chez toutes les boucheries affichées ?",
                a: "Vous pouvez commander en ligne chez les boucheries partenaires Klik&Go (badge Click & Collect). Pour les autres boucheries référencées, vous pouvez consulter leurs coordonnées et les contacter directement.",
              },
            ].map((faq, i) => (
              <details
                key={i}
                className="group bg-white dark:bg-gray-800 rounded-xl border border-[#ece8e3] dark:border-white/[0.06] overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-5 py-4 font-medium text-gray-900 dark:text-white text-sm">
                  {faq.q}
                  <span className="text-gray-500 dark:text-gray-400 group-open:rotate-180 transition-transform ml-3 shrink-0">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-300">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Call to action ── */}
        <section className="text-center py-10 bg-gradient-to-br from-[#DC2626]/5 to-transparent rounded-2xl">
          <Search className="mx-auto mb-3 text-[#DC2626]" size={32} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-display">
            Vous préférez chercher par ville ?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5 max-w-md mx-auto">
            Consultez notre annuaire complet des boucheries halal en Rhône-Alpes, par ville et par quartier.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-[#DC2626] text-white rounded-xl font-semibold hover:bg-[#b91c1c] transition"
          >
            Voir toutes les boucheries
          </Link>
        </section>
      </div>
    </div>
  );
}
