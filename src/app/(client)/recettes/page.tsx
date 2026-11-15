// src/app/(client)/recettes/page.tsx — Recipe list, prerendered (ISR). The theme filter runs on
// the client (RecipeBrowser): the server never reads the query string, which would render the
// page at every request. One hour: recipes are published by hand, rarely.
export const revalidate = 3600;

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, Users, Beef } from "lucide-react";
import prisma from "@/lib/prisma";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { JsonLd } from "@/components/seo/JsonLd";
import { collectionPageJsonLd } from "@/lib/seo/jsonld/pages";
import { isRecipeIndexable } from "@/lib/seo/recipes";
import { absoluteUrl } from "@/lib/seo/site";
import { RecipeBrowser, type RecipeListItem } from "./RecipeBrowser";

const PAGE_PATH = "/recettes";
const PAGE_LAST_UPDATED = "2026-11-15";
const DESCRIPTION =
  "Recettes halal faciles avec la quantité de viande à prévoir : tajine d'agneau, couscous, kefta, brochettes. Viande à commander en click & collect.";

export const metadata: Metadata = {
  title: "Recettes halal — Tajine, couscous, kefta, BBQ",
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(PAGE_PATH) },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Recettes halal — Tajine, couscous, kefta, BBQ | Klik&Go",
    description: DESCRIPTION,
    url: absoluteUrl(PAGE_PATH),
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Recettes halal Klik&Go" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Recettes halal — Tajine, couscous, kefta",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

const HIGHLIGHTS = [
  {
    icon: Beef,
    title: "Quantité de viande",
    desc: "Les grammes à prévoir sont indiqués pour chaque recette",
  },
  {
    icon: Clock,
    title: "Temps indiqués",
    desc: "Préparation et cuisson précisées sur chaque fiche",
  },
  {
    icon: Users,
    title: "Nombre de convives",
    desc: "Chaque fiche dit pour combien de personnes",
  },
];

export default async function RecettesPage() {
  const rows = await prisma.recipe.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      imageUrl: true,
      totalTime: true,
      servings: true,
      difficulty: true,
      meatQuantity: true,
      tags: true,
      featured: true,
      published: true,
      aiGenerated: true,
    },
  });

  const recipes: RecipeListItem[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    totalTime: row.totalTime,
    servings: row.servings,
    difficulty: row.difficulty,
    meatQuantity: row.meatQuantity,
    tags: row.tags,
    featured: row.featured,
  }));

  // The ItemList names only the recipes that may be indexed, the same rule as the sitemap and
  // the recipe page robots (src/lib/seo/recipes.ts); numberOfItems is its length.
  const collectionSchema = collectionPageJsonLd({
    name: "Recettes halal",
    description: DESCRIPTION,
    path: PAGE_PATH,
    items: rows
      .filter(isRecipeIndexable)
      .map((row) => ({ name: row.title, path: `${PAGE_PATH}/${row.slug}` })),
  });

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: absoluteUrl("/") },
          { name: "Recettes halal", url: absoluteUrl(PAGE_PATH) },
        ]}
      />
      <JsonLd data={collectionSchema} />
      <div className="mx-auto max-w-4xl px-4 py-8">
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
          Des recettes halal faciles, avec la quantité de viande à prévoir pour chacune.
        </p>
        <LastUpdated date={PAGE_LAST_UPDATED} className="mt-2 pl-14" />

        <section className="mt-6 rounded-3xl border border-[#ece8e3] bg-white p-6 dark:border-white/[0.06] dark:bg-gray-800/60">
          <h2 className="font-display text-lg font-bold text-[#1C1512] dark:text-white">
            Pourquoi cuisiner halal avec Klik&amp;Go ?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Chaque recette indique la <strong>quantité de viande halal</strong> à prévoir pour le
            nombre de convives annoncé &mdash; fini le calcul de tête au comptoir. Vous commandez la
            viande chez votre boucher de proximité, vous la récupérez en boutique dès qu&apos;elle
            est prête ou au créneau choisi, puis vous passez en cuisine. Chaque fiche détaille les
            ingrédients, les étapes, le temps de préparation et le temps de cuisson. Bœuf, agneau,
            veau, volaille, kefta, plats de fête (Aïd, Ramadan), recettes rapides du soir, BBQ
            d&apos;été : il y en a pour tous les goûts et tous les niveaux.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DC2626]/10 text-[#DC2626]">
                  <item.icon size={14} aria-hidden="true" />
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

        <RecipeBrowser recipes={recipes} />
      </div>
    </div>
  );
}
