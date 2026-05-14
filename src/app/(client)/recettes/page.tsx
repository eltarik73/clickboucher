// src/app/(client)/recettes/page.tsx — Liste des recettes halal IA
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChefHat, Clock, Users, Beef } from "lucide-react";
import prisma from "@/lib/prisma";
import { SafeImage } from "@/components/ui/SafeImage";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";
const PAGE_LAST_UPDATED = "2026-05-09";

export const metadata: Metadata = {
  title: "Recettes halal — Tajine, couscous, kefta, BBQ",
  description:
    "Plus de 50 recettes halal faciles avec quantités de viande précises : tajine d'agneau, couscous royal, brochettes, kefta, shawarma. Commandez la viande halal en click & collect chez votre boucher de proximité.",
  alternates: { canonical: `${SITE_URL}/recettes` },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Recettes halal — Tajine, couscous, kefta, BBQ | Klik&Go",
    description:
      "Plus de 50 recettes halal faciles avec quantités de viande précises. Commandez la viande halal en click & collect.",
    url: `${SITE_URL}/recettes`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Recettes halal Klik&Go" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Recettes halal — Tajine, couscous, kefta",
    description: "Plus de 50 recettes halal avec viande halal en click & collect.",
    images: ["/og-image.png"],
  },
};

const TAGS = [
  { id: null, label: "Tout", icon: "" },
  { id: "boeuf", label: "Boeuf", icon: "🐄" },
  { id: "agneau", label: "Agneau", icon: "🐑" },
  { id: "volaille", label: "Volaille", icon: "🍗" },
  { id: "veau", label: "Veau", icon: "🐂" },
  { id: "bbq", label: "BBQ", icon: "🔥" },
  { id: "ramadan", label: "Ramadan", icon: "🌙" },
  { id: "rapide", label: "Rapide", icon: "⏱" },
  { id: "famille", label: "Famille", icon: "👨‍👩‍👧‍👦" },
];

export default async function RecettesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;

  const recipes = await prisma.recipe.findMany({
    where: {
      published: true,
      ...(tag && { tags: { has: tag } }),
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const featured = recipes.find((r) => r.featured) || recipes[0];
  const others = recipes.filter((r) => r.id !== featured?.id);

  // CollectionPage + ItemList schema (audit SEO QW8) — gives Google a clean
  // map of all 49 recipes so the section ranks in the Recipes vertical.
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/recettes`,
    name: "Recettes halal — Klik&Go",
    description:
      "Recettes halal avec quantités de viande précises et lien direct vers les boucheries halal partenaires en click & collect.",
    url: `${SITE_URL}/recettes`,
    inLanguage: "fr-FR",
    isPartOf: { "@type": "WebSite", "@id": SITE_URL, name: "Klik&Go" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: recipes.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: recipes.slice(0, 30).map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/recettes/${r.slug}`,
        name: r.title,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Recettes halal", url: `${SITE_URL}/recettes` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Back + Hero */}
        <div className="mb-1 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/5"
            aria-label="Retour"
          >
            <ArrowLeft size={18} className="text-gray-700 dark:text-gray-300" />
          </Link>
          <h1 className="text-3xl font-black text-[#1C1512] dark:text-white">Recettes halal 🍖</h1>
        </div>
        <p className="mt-1 pl-14 text-gray-600 dark:text-gray-400">
          {recipes.length}+ recettes halal faciles avec quantités précises et lien direct vers la
          boucherie partenaire.
        </p>
        <LastUpdated date={PAGE_LAST_UPDATED} className="mt-2 pl-14" />

        {/* ── Intro éditoriale (signal contenu unique anti-thin) ── */}
        <section className="mt-6 rounded-3xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800/60">
          <h2 className="font-display text-lg font-bold text-[#1C1512] dark:text-white">
            Pourquoi cuisiner halal avec Klik&amp;Go ?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Toutes nos recettes affichent la <strong>quantité exacte de viande halal</strong> à
            commander pour le nombre de convives indiqué &mdash; fini le calcul de tête au comptoir.
            En un clic, vous commandez la viande certifiée halal chez votre boucher de proximité,
            vous la récupérez au créneau choisi, et vous attaquez la recette le soir même. Chaque
            fiche détaille les ingrédients, le temps de préparation, le matériel nécessaire et la
            valeur nutritionnelle estimée. Bœuf, agneau, veau, volaille, kefta, merguez maison,
            plats de fête (Aïd, Ramadan), recettes rapides du soir, BBQ d&apos;été : il y en a pour
            tous les goûts et tous les niveaux.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Beef,
                title: "Quantités précises",
                desc: "g de viande par personne calculé pour chaque recette",
              },
              {
                icon: Clock,
                title: "Temps réaliste",
                desc: "Prépa + cuisson testés et validés en cuisine",
              },
              {
                icon: Users,
                title: "Adaptable convives",
                desc: "Multipliez les portions, le panier suit",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DC2626]/10 text-[#DC2626]">
                  <item.icon size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#1C1512] dark:text-white">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Hub catégories (différenciation contenu + maillage interne) ── */}
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#1C1512] dark:text-white">
            <ChefHat size={16} className="text-[#DC2626]" />
            Nos univers de recettes halal
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                tag: "ramadan",
                label: "Spécial Ramadan",
                desc: "Plats de rupture du jeûne, harira, soupes, msemen sucrés-salés.",
                emoji: "🌙",
              },
              {
                tag: "bbq",
                label: "BBQ &amp; brochettes",
                desc: "Brochettes de bœuf, agneau marinés, kefta &mdash; saison estivale.",
                emoji: "🔥",
              },
              {
                tag: "rapide",
                label: "Recettes rapides",
                desc: "Moins de 30 minutes total &mdash; idéal soirées semaine.",
                emoji: "⏱",
              },
              {
                tag: "famille",
                label: "Plats famille",
                desc: "Tajines, couscous, plats généreux pour 4 à 8 convives.",
                emoji: "👨‍👩‍👧‍👦",
              },
            ].map((cat) => (
              <Link
                key={cat.tag}
                href={`/recettes?tag=${cat.tag}`}
                className="group flex gap-3 rounded-2xl border border-[#ece8e3] bg-white p-4 transition hover:border-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="text-2xl">{cat.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-bold text-[#1C1512] dark:text-white"
                    dangerouslySetInnerHTML={{ __html: cat.label }}
                  />
                  <p
                    className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
                    dangerouslySetInnerHTML={{ __html: cat.desc }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Filtres tags */}
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 py-4"
          style={{ scrollbarWidth: "none" }}
        >
          {TAGS.map((t) => (
            <Link
              key={t.id || "all"}
              href={t.id ? `/recettes?tag=${t.id}` : "/recettes"}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tag === t.id || (!tag && !t.id)
                  ? "bg-[#DC2626] text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-[#DC2626] dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-400"
              }`}
            >
              {t.icon ? `${t.icon} ` : ""}
              {t.label}
            </Link>
          ))}
        </div>

        {/* Recette du jour (featured) */}
        {featured && (
          <Link href={`/recettes/${featured.slug}`} className="mb-6 block">
            <div className="overflow-hidden rounded-3xl border border-[#ece8e3]/60 bg-white shadow-md transition hover:shadow-lg dark:border-white/[0.06] dark:bg-gray-800">
              <div className="relative h-52 overflow-hidden bg-gray-200 dark:bg-white/5">
                {featured.imageUrl ? (
                  <SafeImage
                    src={featured.imageUrl}
                    alt={featured.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 896px"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl">🍖</div>
                )}
                <div className="absolute left-3 top-3 rounded-lg bg-[#DC2626] px-3 py-1 text-xs font-bold text-white">
                  Recette du jour
                </div>
                <div className="absolute bottom-3 right-3 rounded-lg bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  ⏱ {featured.totalTime} min
                </div>
              </div>
              <div className="p-4">
                <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white">
                  {featured.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {featured.description}
                </p>
                <div className="mt-3 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>👤 {featured.servings} pers.</span>
                  <span>📊 {featured.difficulty}</span>
                </div>
                {/* Viande nécessaire */}
                {/* Audit a11y 2026-05-10 : text-[#DC2626] sur bg-red-50 = ratio 4.0 FAIL AA small text.
                    text-[#991b1b] (red-800) = ratio ~7.0 PASS. text-gray-500 → text-gray-700 sur fond rouge léger. */}
                <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-xs font-bold text-[#991b1b] dark:text-red-300">
                    🥩 {featured.meatQuantity}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-700 dark:text-gray-300">
                    Disponible chez nos boucheries partenaires
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Liste des autres recettes */}
        <div className="space-y-3">
          {others.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recettes/${recipe.slug}`}
              className="flex gap-3 rounded-2xl border border-[#ece8e3]/60 bg-white p-3 transition hover:shadow-sm dark:border-white/[0.06] dark:bg-gray-800"
            >
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-200 dark:bg-white/5">
                {recipe.imageUrl ? (
                  <SafeImage
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🍖</div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h3 className="line-clamp-2 text-sm font-bold text-[#1C1512] dark:text-white">
                  {recipe.title}
                </h3>
                <div className="mt-1 text-xs font-semibold text-[#DC2626]">
                  🥩 {recipe.meatQuantity}
                </div>
                <div className="mt-1 flex gap-2">
                  <span className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/5 dark:text-gray-400">
                    ⏱ {recipe.totalTime} min
                  </span>
                  <span className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/5 dark:text-gray-400">
                    {recipe.difficulty}
                  </span>
                  {recipe.tags[0] && (
                    <span className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/5 dark:text-gray-400">
                      {recipe.tags[0]}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty */}
        {recipes.length === 0 && (
          <div className="py-16 text-center">
            <div className="mb-3 text-3xl">🍖</div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Aucune recette pour le moment
            </p>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              De nouvelles recettes sont ajoutées chaque jour !
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#b91c1c]"
            >
              Découvrir les boutiques
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
