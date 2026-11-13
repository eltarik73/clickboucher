import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Search, ShieldCheck, Clock } from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";

const PAGE_LAST_UPDATED = "2026-05-01";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const revalidate = 86400; // contenu éditorial + compteurs : 1 régénération / jour suffit

export const metadata: Metadata = {
  // Le titleTemplate root ("%s | Klik&Go") ajoute déjà la marque — ne pas la
  // répéter ici sinon "… | Klik&Go | Klik&Go" (bug SEO récurrent, audit 2026-06-12).
  title: "Annuaire des boucheries halal en Auvergne-Rhône-Alpes",
  description:
    "Annuaire complet des boucheries halal en Auvergne-Rhône-Alpes : Lyon, Grenoble, Saint-Étienne, Chambéry, Annecy, Aix-les-Bains. Plus de 30 villes couvertes, click & collect, retrait en boutique.",
  keywords: [
    "boucherie halal rhone alpes",
    "boucherie halal auvergne rhone alpes",
    "annuaire boucherie halal rhone alpes",
    "boucherie halal savoie",
    "boucherie halal haute savoie",
    "boucherie halal isere",
    "boucherie halal rhone",
    "boucherie halal loire",
  ],
  openGraph: {
    title: "Annuaire des boucheries halal en Auvergne-Rhône-Alpes",
    description:
      "30+ villes couvertes : Lyon, Grenoble, Saint-Étienne, Chambéry, Annecy. Click & collect, retrait en boutique.",
    url: `${SITE_URL}/boucheries-halal-rhone-alpes`,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Boucheries halal Rhône-Alpes" },
    ],
    siteName: "Klik&Go",
  },
  twitter: { card: "summary_large_image", title: "Annuaire boucheries halal Rhône-Alpes" },
  alternates: { canonical: `${SITE_URL}/boucheries-halal-rhone-alpes` },
};

export default async function RegionalHubPage() {
  const totalShops = await prisma.shop.count({ where: { visible: true } });

  // Group cities by department for the hub
  const citiesByDept = SEO_DEPARTMENTS.map((dept) => ({
    ...dept,
    cities: SEO_CITIES.filter((c) => dept.citySlugs.includes(c.slug)),
  }));

  // Top 12 cities for the hero (most populated regions)
  const topCities = SEO_CITIES.filter((c) =>
    [
      "lyon",
      "grenoble",
      "saint-etienne",
      "chambery",
      "annecy",
      "aix-les-bains",
      "villeurbanne",
      "venissieux",
      "annemasse",
      "voiron",
      "bourgoin-jallieu",
      "roanne",
    ].includes(c.slug)
  );

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* ── Schemas ── */}
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Boucheries halal Rhône-Alpes", url: `${SITE_URL}/boucheries-halal-rhone-alpes` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Annuaire des boucheries halal en Auvergne-Rhône-Alpes",
            description:
              "Annuaire complet des boucheries halal certifiées en Auvergne-Rhône-Alpes. Plus de 30 villes couvertes.",
            url: `${SITE_URL}/boucheries-halal-rhone-alpes`,
            isPartOf: { "@type": "WebSite", name: "Klik&Go", url: SITE_URL },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: SEO_CITIES.length,
              itemListElement: SEO_CITIES.slice(0, 30).map((city, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "Place",
                  name: `Boucheries halal à ${city.name}`,
                  url: `${SITE_URL}/boucherie-halal/${city.slug}`,
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: city.name,
                    addressRegion: city.region,
                    addressCountry: "FR",
                  },
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: city.latitude,
                    longitude: city.longitude,
                  },
                },
              })),
            },
          }),
        }}
      />
      {/* TLDR for AI parsers */}
      <section className="sr-only" aria-label="Résumé" data-purpose="ai-summary">
        <p>
          <strong>En bref :</strong> Klik&amp;Go référence les boucheries halal certifiées dans
          toute la région Auvergne-Rhône-Alpes (5 départements : Savoie, Haute-Savoie, Isère, Rhône,
          Loire). Plus de 30 villes couvertes : Lyon, Grenoble, Saint-Étienne, Chambéry, Annecy,
          Villeurbanne, Vénissieux, Vaulx-en-Velin, Aix-les-Bains, Annemasse, Roanne. Commande en
          ligne possible chez les boucheries partenaires, retrait en boutique au créneau choisi.
          Frais de service : 0,99€ par commande.
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
          <p className="mt-4 max-w-3xl text-lg text-white/80">
            L&apos;annuaire de référence des boucheries halal certifiées en Rhône-Alpes : Savoie,
            Haute-Savoie, Isère, Rhône et Loire. Plus de 30 villes couvertes, commandez en ligne et
            récupérez votre viande en click &amp; collect.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {SEO_CITIES.length} villes référencées
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} />
              {totalShops} boucheries partenaires
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              Retrait dès 30 min
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
        {/* ── Top 12 villes (carrousel cards) ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Les 12 villes les plus actives
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {topCities.map((city) => (
              <Link
                key={city.slug}
                href={`/boucherie-halal/${city.slug}`}
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
            5 départements couverts en Auvergne-Rhône-Alpes
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {citiesByDept.map((dept) => (
              <Link
                key={dept.slug}
                href={`/boucheries-halal/${dept.slug}`}
                className="group block rounded-2xl border border-[#ece8e3] bg-white p-5 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">{dept.name}</h3>
                  <ArrowRight
                    size={18}
                    className="mt-0.5 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-[#DC2626]"
                  />
                </div>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  {dept.cities.length} villes référencées
                </p>
                <div className="flex flex-wrap gap-1">
                  {dept.cities.slice(0, 4).map((c) => (
                    <span
                      key={c.slug}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {c.name}
                    </span>
                  ))}
                  {dept.cities.length > 4 && (
                    <span className="text-[11px] text-gray-400">+{dept.cities.length - 4}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Contenu éditorial / E-E-A-T ── */}
        <section className="mb-14 rounded-2xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800 sm:p-8">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
            La référence des boucheries halal en Rhône-Alpes
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-3 text-gray-700 dark:text-gray-300">
            <p>
              L&apos;Auvergne-Rhône-Alpes est la deuxième région la plus peuplée de France avec plus
              de 8 millions d&apos;habitants, et abrite l&apos;une des plus importantes communautés
              musulmanes du pays. Lyon, Grenoble, Saint-Étienne, Chambéry, Annecy, Villeurbanne,
              Vénissieux, Vaulx-en-Velin et leurs agglomérations concentrent des centaines de
              boucheries halal de proximité, héritières de plusieurs générations
              d&apos;artisans-bouchers.
            </p>
            <p>
              <strong>Klik&amp;Go</strong> est l&apos;annuaire spécialisé qui référence les
              boucheries halal certifiées de toute la région. Pour chaque ville, vous trouvez les
              coordonnées, horaires, spécialités et la possibilité de commander en ligne chez les
              boucheries partenaires. Notre géolocalisation vous permet aussi de trouver
              instantanément la boucherie halal la plus proche de chez vous.
            </p>
            <p>
              Toutes nos boucheries partenaires sont vérifiées halal, sélectionnent leurs viandes
              auprès d&apos;éleveurs locaux (Beaujolais, Bauges, Forez, Pilat, Aravis, Dombes,
              Chablais), et proposent des produits frais en click &amp; collect : viande
              quotidienne, mais aussi spécialités pour le Ramadan, l&apos;Aïd al-Adha, les mariages
              et les méchouis.
            </p>
            <p>
              <strong>Frais de service Klik&amp;Go :</strong> seulement 0,99€ par commande, pas
              d&apos;abonnement, pas de surcoût sur les prix des produits. Le boucher fixe ses prix,
              vous payez en ligne ou sur place, vous récupérez votre commande au créneau qui vous
              arrange.
            </p>
          </div>
        </section>

        {/* ── 4 piliers ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
            Pourquoi choisir Klik&amp;Go ?
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                emoji: "📍",
                title: "Géolocalisation",
                desc: "Trouvez la boucherie halal la plus proche en un clic.",
              },
              {
                emoji: "✅",
                title: "Halal certifié",
                desc: "Toutes les boucheries partenaires sont vérifiées halal.",
              },
              {
                emoji: "🛍️",
                title: "Click & Collect",
                desc: "Commandez, payez en ligne, récupérez sans attendre.",
              },
              {
                emoji: "💰",
                title: "0,99€ de frais",
                desc: "Pas d'abonnement, pas de commission cachée.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#ece8e3] bg-white p-5 dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-2 text-3xl">{item.emoji}</div>
                <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {item.desc}
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
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: [
                  {
                    "@type": "Question",
                    name: "Combien de boucheries halal sont référencées en Auvergne-Rhône-Alpes sur Klik&Go ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: `Klik&Go référence les boucheries halal certifiées dans plus de ${SEO_CITIES.length} villes en Auvergne-Rhône-Alpes, réparties sur les 5 départements : Savoie, Haute-Savoie, Isère, Rhône et Loire.`,
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Quelles sont les villes les plus couvertes en Rhône-Alpes ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Lyon, Grenoble, Saint-Étienne, Chambéry, Annecy, Villeurbanne, Vénissieux, Vaulx-en-Velin, Aix-les-Bains et Annemasse sont les 10 villes principales avec le plus de boucheries halal partenaires Klik&Go. Tous les arrondissements lyonnais (3, 7, 8, 9) et tous les quartiers (Guillotière, Vaise, Croix-Rousse, Bissy, Cognin, etc.) sont couverts.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Comment commander de la viande halal en ligne en Rhône-Alpes ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Choisissez votre ville, sélectionnez une boucherie halal partenaire, ajoutez vos produits au panier, payez en ligne ou sur place, et récupérez votre commande en boutique au créneau choisi. Frais de service : 0,99€ par commande.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Klik&Go propose-t-il la livraison ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Klik&Go propose uniquement le click & collect (retrait en boutique). C'est plus rapide qu'une livraison (souvent 30 min) et sans frais supplémentaires liés à la livraison.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Quel département choisir pour trouver une boucherie halal en Rhône-Alpes ?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Pour Lyon et son agglomération (Villeurbanne, Vénissieux, Vaulx-en-Velin, Bron, Saint-Priest), allez sur la page Rhône. Pour Grenoble, Échirolles, Voiron, Bourgoin-Jallieu : Isère. Pour Saint-Étienne, Roanne, Firminy : Loire. Pour Chambéry, Aix-les-Bains, Albertville : Savoie. Pour Annecy, Annemasse, Thonon, Cluses : Haute-Savoie.",
                    },
                  },
                ],
              }),
            }}
          />
          <div className="space-y-3">
            {[
              {
                q: "Combien de boucheries halal sont référencées en Auvergne-Rhône-Alpes sur Klik&Go ?",
                a: `Klik&Go référence les boucheries halal certifiées dans plus de ${SEO_CITIES.length} villes en Auvergne-Rhône-Alpes, réparties sur les 5 départements : Savoie, Haute-Savoie, Isère, Rhône et Loire.`,
              },
              {
                q: "Quelles sont les villes les plus couvertes en Rhône-Alpes ?",
                a: "Lyon, Grenoble, Saint-Étienne, Chambéry, Annecy, Villeurbanne, Vénissieux, Vaulx-en-Velin, Aix-les-Bains et Annemasse sont les 10 villes principales avec le plus de boucheries halal partenaires Klik&Go.",
              },
              {
                q: "Comment commander de la viande halal en ligne en Rhône-Alpes ?",
                a: "Choisissez votre ville, sélectionnez une boucherie halal partenaire, ajoutez vos produits au panier, payez en ligne ou sur place, et récupérez votre commande en boutique au créneau choisi. Frais de service : 0,99€ par commande.",
              },
              {
                q: "Klik&Go propose-t-il la livraison ?",
                a: "Klik&Go propose uniquement le click & collect (retrait en boutique). C'est plus rapide qu'une livraison (souvent 30 min) et sans frais supplémentaires.",
              },
              {
                q: "Quel département choisir pour trouver une boucherie halal en Rhône-Alpes ?",
                a: "Pour Lyon et son agglomération : Rhône. Pour Grenoble : Isère. Pour Saint-Étienne : Loire. Pour Chambéry/Aix : Savoie. Pour Annecy : Haute-Savoie.",
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
      </div>
    </div>
  );
}
