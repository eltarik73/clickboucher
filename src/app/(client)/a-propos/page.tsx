import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Heart, ShieldCheck, Users, Sparkles, Store, MapPin } from "lucide-react";
import prisma from "@/lib/prisma";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SEO_CITIES } from "@/lib/seo/cities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";
const PAGE_LAST_UPDATED = "2026-05-09";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "À propos de Klik&Go — Notre mission, notre équipe",
  description:
    "Klik&Go est la première plateforme click & collect dédiée aux boucheries halal en France. Notre mission : zéro file d'attente, 100% halal certifié, 0,99€ de frais. Découvrez notre histoire, notre équipe et nos valeurs.",
  alternates: { canonical: `${SITE_URL}/a-propos` },
  openGraph: {
    title: "À propos de Klik&Go — Notre mission, notre équipe",
    description:
      "Plateforme click & collect dédiée aux boucheries halal. Découvrez notre histoire et nos valeurs.",
    url: `${SITE_URL}/a-propos`,
    siteName: "Klik&Go",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "À propos Klik&Go" }],
  },
};

export default async function AProposPage() {
  // Stats dynamiques DB pour signal de fraîcheur + crédibilité (E-E-A-T 2026)
  const [shopCount, recipeCount] = await Promise.all([
    prisma.shop.count({ where: { visible: true } }),
    prisma.recipe.count({ where: { published: true } }).catch(() => 0),
  ]);
  const cityCount = SEO_CITIES.length;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "À propos", url: `${SITE_URL}/a-propos` },
        ]}
      />
      {/* AboutPage schema (signal E-E-A-T fort, attendu par Google + IA) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "@id": `${SITE_URL}/a-propos`,
            name: "À propos de Klik&Go",
            url: `${SITE_URL}/a-propos`,
            inLanguage: "fr-FR",
            isPartOf: { "@type": "WebSite", "@id": SITE_URL, name: "Klik&Go" },
            mainEntity: {
              "@type": "Organization",
              name: "Klik&Go",
              alternateName: ["Klikandgo", "Klik and Go"],
              url: SITE_URL,
              logo: `${SITE_URL}/logo.png`,
              foundingDate: "2025",
              description:
                "Plateforme click & collect dédiée aux boucheries halal en Auvergne-Rhône-Alpes",
              founder: { "@type": "Person", name: "Tarik" },
              areaServed: {
                "@type": "AdministrativeArea",
                name: "Auvergne-Rhône-Alpes",
              },
              numberOfEmployees: { "@type": "QuantitativeValue", value: "1-10" },
              slogan: "Zéro file. Zéro stress. 100% frais.",
            },
          }),
        }}
      />

      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-[#DC2626] dark:text-gray-400"
        >
          <ArrowLeft size={14} /> Retour à l&apos;accueil
        </Link>

        <h1 className="font-display text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">
          À propos de Klik&amp;Go
        </h1>
        <p className="mt-3 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Plateforme click &amp; collect dédiée aux boucheries halal en Auvergne-Rhône-Alpes. Notre
          mission : <strong>zéro file d&apos;attente, zéro stress, 100% frais</strong>.
        </p>
        <LastUpdated date={PAGE_LAST_UPDATED} className="mt-3" />

        {/* ── Chiffres clés dynamiques (signal fraîcheur Perplexity/ChatGPT) ── */}
        <section className="mt-8 grid grid-cols-3 gap-3">
          {[
            { value: shopCount, label: "Boucheries halal", icon: Store },
            { value: cityCount, label: "Villes couvertes", icon: MapPin },
            { value: `${recipeCount}+`, label: "Recettes halal", icon: Sparkles },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#ece8e3] bg-white p-4 text-center dark:border-white/[0.06] dark:bg-gray-800"
            >
              <div className="mb-1 flex justify-center">
                <stat.icon size={18} className="text-[#DC2626]" />
              </div>
              <div className="font-display text-2xl font-black text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                {stat.label}
              </div>
            </div>
          ))}
        </section>

        <div className="prose prose-sm dark:prose-invert mt-10 max-w-none space-y-5 text-gray-700 dark:text-gray-300">
          <h2 className="mt-8 text-xl font-bold text-gray-900 dark:text-white">
            Pourquoi Klik&amp;Go ?
          </h2>
          <p>
            Le samedi midi, le vendredi soir, pendant tout le mois de Ramadan, à l&apos;approche de
            l&apos;Aïd : les boucheries halal sont saturées. Files d&apos;attente de 30 minutes,
            commandes oubliées sur la pause déjeuner, stress avant les fêtes. Cette réalité n&apos;a
            pas changé depuis 30 ans &mdash; alors que toute la restauration classique a digitalisé
            son flux client (Uber Eats, Deliveroo, La Fourchette). Klik&amp;Go porte cette
            modernisation aux artisans bouchers halal de proximité, avec un outil simple : le client
            commande en ligne au calme, paie ou réserve, le boucher prépare au créneau choisi, le
            client récupère en deux minutes.
          </p>

          <h2 className="mt-8 text-xl font-bold text-gray-900 dark:text-white">
            Soutenir les bouchers halal indépendants
          </h2>
          <p>
            Contrairement aux géants de la livraison qui prennent jusqu&apos;à 30% de commission sur
            chaque vente (et qui imposent souvent leurs tarifs aux commerçants), Klik&amp;Go facture{" "}
            <strong>0,99€ de frais de service par commande</strong>, payés par le client &mdash; et
            une commission modérée pour le boucher uniquement quand il vend (pas d&apos;abonnement,
            pas de frais d&apos;entrée). Notre modèle : si le boucher ne vend pas, il ne paie pas.
            Les artisans halal méritent les mêmes outils numériques que les grandes chaînes, sans
            les abus économiques qui vont avec.
          </p>

          <h2 className="mt-8 text-xl font-bold text-gray-900 dark:text-white">
            100% halal, 100% local, 100% transparent
          </h2>
          <p>
            Toutes les boucheries référencées sur Klik&amp;Go sont des boucheries halal
            indépendantes vérifiées avant mise en ligne. La certification halal (AVS, ACMIF, Mosquée
            de Paris, etc.) est sous la responsabilité directe du boucher partenaire, qui
            l&apos;affiche sur sa fiche. Nous ne sommes pas un revendeur qui rachète et redistribue
            : Klik&amp;Go est un <strong>outil au service du boucher de quartier</strong>, qui garde
            la main sur ses prix, son catalogue, ses horaires, et la relation directe avec ses
            clients.
          </p>
        </div>

        {/* ── Nos valeurs (4 piliers) ── */}
        <section className="mt-12">
          <h2 className="mb-5 font-display text-xl font-bold text-gray-900 dark:text-white">
            Nos valeurs
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: ShieldCheck,
                title: "Halal certifié, sans zone grise",
                desc: "Chaque produit affiche son organisme certificateur. Pas de promesse vague, pas de raccourci sur la traçabilité.",
              },
              {
                icon: Users,
                title: "Artisans, pas grande distribution",
                desc: "Nous travaillons exclusivement avec des bouchers halal indépendants. Pas de multinationale, pas de circuit industriel.",
              },
              {
                icon: Heart,
                title: "Économie locale circulaire",
                desc: "L'argent que vous dépensez reste dans le quartier. Pas de commission abusive captée par un siège à San Francisco.",
              },
              {
                icon: Sparkles,
                title: "Transparence radicale",
                desc: "Prix identiques à ceux du magasin, frais affichés (0,99€), aucune surprise au moment de payer. Pas d'optimisation cachée.",
              },
            ].map((value, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DC2626]/10 text-[#DC2626]">
                  <value.icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {value.title}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {value.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Notre histoire (timeline courte) ── */}
        <section className="mt-12">
          <h2 className="mb-5 font-display text-xl font-bold text-gray-900 dark:text-white">
            Notre histoire
          </h2>
          <div className="space-y-4 border-l-2 border-[#DC2626]/20 pl-5">
            {[
              {
                year: "2025",
                title: "Idée et premier prototype",
                desc: "Tarik, fondateur, fait la queue 35 minutes un samedi matin chez son boucher halal habituel à Chambéry. Il rentre chez lui et code le premier prototype Klik&Go le week-end suivant.",
              },
              {
                year: "Début 2026",
                title: "Lancement à Chambéry et Aix-les-Bains",
                desc: "Premières boucheries partenaires en Savoie. Validation du modèle commission-only. Itérations rapides sur le mode Cuisine pour les bouchers (UX 80mm thermal Uber Eats style).",
              },
              {
                year: "Mai 2026",
                title: "Extension Auvergne-Rhône-Alpes",
                desc: `Couverture étendue à ${cityCount} villes principales (Lyon, Grenoble, Saint-Étienne, Annecy, Valence). Plus de ${shopCount} boucheries référencées. Lancement du programme de fidélité 3 paliers et des recettes halal IA-générées (${recipeCount}+).`,
              },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-[#DC2626] bg-white dark:bg-[#0a0a0a]" />
                <div className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
                  {step.year}
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {step.title}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA finale ── */}
        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-[#DC2626] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b91c1c]"
          >
            Voir les boucheries
          </Link>
          <Link
            href="/espace-boucher"
            className="rounded-full border border-[#ece8e3] bg-white px-5 py-3 text-sm font-semibold transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
          >
            Je suis boucher
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-[#ece8e3] bg-white px-5 py-3 text-sm font-semibold transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
          >
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  );
}
