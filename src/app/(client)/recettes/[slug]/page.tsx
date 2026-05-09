// src/app/(client)/recettes/[slug]/page.tsx — Détail recette halal IA
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { SafeImage } from "@/components/ui/SafeImage";
import { RecipeSchema } from "@/components/seo/RecipeSchema";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
  isMeat: boolean;
  productCategory?: string;
};

type Step = {
  number: number;
  text: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe) return {};
  const url = `${SITE_URL}/recettes/${slug}`;
  const ogImage = recipe.imageUrl
    ? recipe.imageUrl.startsWith("http")
      ? recipe.imageUrl
      : `${SITE_URL}${recipe.imageUrl}`
    : `${SITE_URL}/og-image.png`;

  // Bing Site Scan a flagué 45 recettes en "Title too long" (> 70 chars).
  // Cause : recettes IA-générées avec noms très longs (ex "Carré d'Agneau
  // Doré en Croûte d'Herbes Printanières aux Légumes Festifs" = 76 chars
  // déjà sans suffix). On tronque proprement sur un espace, puis on ajoute
  // un suffix court "— Halal". Le titleTemplate root ajoute " | Klik&Go".
  // Budget total : 50 (title) + 8 (— Halal) + 10 (| Klik&Go) = 68 chars max.
  function truncateTitle(s: string, max: number): string {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.!?]+$/, "") + "…";
  }
  const titleBase = truncateTitle(recipe.title, 50);
  const title = `${titleBase} — Halal`;
  const description = `${recipe.description} Pour ${recipe.servings} personnes en ${recipe.totalTime} min. ${recipe.meatQuantity} de viande halal — commande click & collect chez votre boucher.`;

  // Mars 2026 Core Update : Google rejette en masse le contenu IA thin.
  // GSC remontait 32 recettes en "Détectée non indexée". On noindex les
  // recettes générées qui n'ont pas été manuellement reviewées (featured),
  // pour préserver le signal de qualité du domaine entier.
  const shouldNoIndex = recipe.aiGenerated && !recipe.featured;

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(shouldNoIndex && {
      robots: { index: false, follow: true },
    }),
    openGraph: {
      type: "article",
      title: `${title} | Klik&Go`,
      description,
      url,
      siteName: "Klik&Go",
      locale: "fr_FR",
      images: [{ url: ogImage, width: 1200, height: 630, alt: recipe.title }],
      publishedTime: new Date(recipe.publishedAt).toISOString(),
      modifiedTime: new Date(recipe.updatedAt).toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function RecettePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe || !recipe.published) notFound();

  const ingredients = recipe.ingredients as Ingredient[];
  const steps = recipe.steps as Step[];
  const meatIngredients = ingredients.filter((i) => i.isMeat);

  // Trouver les boucheries qui vendent ces types de viande
  const meatCategories = meatIngredients.map((i) => i.productCategory).filter(Boolean) as string[];

  const shops =
    meatCategories.length > 0
      ? await prisma.shop.findMany({
          where: {
            visible: true,
            products: {
              some: {
                inStock: true,
                isActive: true,
                categories: {
                  some: {
                    name: { in: meatCategories, mode: "insensitive" },
                  },
                },
              },
            },
          },
          select: { id: true, name: true, slug: true, city: true },
          take: 5,
        })
      : await prisma.shop.findMany({
          where: { visible: true },
          select: { id: true, name: true, slug: true, city: true },
          take: 3,
        });

  // Recettes similaires
  const similar = await prisma.recipe.findMany({
    where: {
      published: true,
      id: { not: recipe.id },
      meatType: recipe.meatType,
    },
    take: 4,
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <RecipeSchema
        recipe={{
          slug: recipe.slug,
          title: recipe.title,
          description: recipe.description,
          imageUrl: recipe.imageUrl,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          totalTime: recipe.totalTime,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          ingredients,
          steps,
          tags: recipe.tags,
          meatType: recipe.meatType,
          publishedAt: recipe.publishedAt,
          updatedAt: recipe.updatedAt,
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Recettes", url: `${SITE_URL}/recettes` },
          { name: recipe.title, url: `${SITE_URL}/recettes/${slug}` },
        ]}
      />
      <div className="mx-auto max-w-2xl">
        {/* Image */}
        <div className="relative h-60 overflow-hidden bg-gray-200 dark:bg-white/5">
          {recipe.imageUrl ? (
            <SafeImage
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-100 to-orange-100 text-5xl dark:from-red-900/20 dark:to-orange-900/20">
              🍖
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
              >
                {tag}
              </span>
            ))}
          </div>
          <Link
            href="/recettes"
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-sm text-white backdrop-blur transition hover:bg-black/70"
          >
            ←
          </Link>
        </div>

        <div className="px-4 py-5">
          {/* Titre */}
          <h1 className="text-2xl font-black leading-tight text-[#1C1512] dark:text-white">
            {recipe.title}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{recipe.description}</p>

          {/* Infos rapides */}
          <div className="mt-4 flex gap-4 border-y border-gray-200/50 py-3 dark:border-white/[0.06]">
            <div className="flex-1 text-center">
              <div className="text-lg font-extrabold text-[#1C1512] dark:text-white">
                {recipe.totalTime} min
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Temps total</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-lg font-extrabold text-[#1C1512] dark:text-white">
                {recipe.servings}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Personnes</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-lg font-extrabold text-[#1C1512] dark:text-white">
                {recipe.difficulty}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Difficulté</div>
            </div>
          </div>

          {/* Commander les ingrédients */}
          <div className="mt-5 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-orange-50 p-4 dark:border-red-800 dark:from-red-900/20 dark:to-orange-900/20">
            <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#DC2626]">
              🛒 Commandez les ingrédients
            </div>
            <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Retrouvez la viande nécessaire chez vos boucheries halal partenaires.
            </div>

            {meatIngredients.map((ing, i) => (
              <div
                key={i}
                className="mb-2 flex items-center gap-3 rounded-xl border border-red-50 bg-white p-3 dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-lg dark:bg-red-900/30">
                  🥩
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#1C1512] dark:text-white">{ing.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {ing.quantity} {ing.unit}
                  </div>
                  {shops.length > 0 && (
                    <div className="mt-0.5 text-[10px] font-semibold text-emerald-600">
                      Dispo chez {shops.length} boucherie
                      {shops.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                {shops.length > 0 && (
                  <Link
                    href={`/boutique/${shops[0].slug}`}
                    className="rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#b91c1c]"
                  >
                    Voir →
                  </Link>
                )}
              </div>
            ))}

            {shops.length > 1 && (
              <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                Également disponible chez :{" "}
                {shops
                  .slice(1)
                  .map((s) => s.name)
                  .join(", ")}
              </div>
            )}
          </div>

          {/* Ingrédients complets */}
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-extrabold text-[#1C1512] dark:text-white">
              Ingrédients
            </h2>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-sm ${
                    ing.isMeat
                      ? "font-bold text-[#1C1512] dark:text-white"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <span className="w-5 text-center">{ing.isMeat ? "🥩" : "•"}</span>
                  <span className="font-semibold">
                    {ing.quantity} {ing.unit}
                  </span>
                  <span>{ing.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Étapes */}
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-extrabold text-[#1C1512] dark:text-white">
              Préparation
            </h2>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.number} className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#DC2626] text-xs font-bold text-white">
                    {step.number}
                  </div>
                  <p className="pt-0.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Badge IA */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
            Recette créée par l&apos;IA Klik&Go ·{" "}
            {new Date(recipe.publishedAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>

          {/* Recettes similaires */}
          {similar.length > 0 && (
            <div className="mt-6 border-t border-gray-200/50 pt-4 dark:border-white/[0.06]">
              <h3 className="mb-3 text-sm font-extrabold text-[#1C1512] dark:text-white">
                Vous aimerez aussi
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                {similar.map((r) => (
                  <Link
                    key={r.id}
                    href={`/recettes/${r.slug}`}
                    className="min-w-[140px] flex-shrink-0 overflow-hidden rounded-xl border border-[#ece8e3]/60 bg-white transition hover:shadow-sm dark:border-white/[0.06] dark:bg-gray-800"
                  >
                    <div className="relative h-20 overflow-hidden bg-gray-200 dark:bg-white/5">
                      {r.imageUrl ? (
                        <SafeImage
                          src={r.imageUrl}
                          alt={r.title}
                          fill
                          className="object-cover"
                          sizes="140px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">
                          🍖
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="line-clamp-2 text-xs font-bold text-[#1C1512] dark:text-white">
                        {r.title}
                      </div>
                      <div className="mt-1 text-[10px] font-semibold text-[#DC2626]">
                        🥩 {r.meatQuantity}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Retour */}
          <div className="mt-6 pb-8">
            <Link
              href="/recettes"
              className="text-sm font-bold text-[#991B1B] underline-offset-2 transition hover:text-[#7F1D1D] hover:underline"
            >
              ← Toutes les recettes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
