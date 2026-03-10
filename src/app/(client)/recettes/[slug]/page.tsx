// src/app/(client)/recettes/[slug]/page.tsx — Détail recette halal IA
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";

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
  return {
    title: `${recipe.title} — Recette halal | Klik&Go`,
    description: `${recipe.description} ${recipe.meatQuantity}. Commandez la viande halal en click & collect.`,
    alternates: { canonical: `${SITE_URL}/recettes/${slug}` },
  };
}

export default async function RecettePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe || !recipe.published) notFound();

  const ingredients = recipe.ingredients as Ingredient[];
  const steps = recipe.steps as Step[];
  const meatIngredients = ingredients.filter((i) => i.isMeat);

  // Trouver les boucheries qui vendent ces types de viande
  const meatCategories = meatIngredients
    .map((i) => i.productCategory)
    .filter(Boolean) as string[];

  const shops = meatCategories.length > 0
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
      <div className="max-w-2xl mx-auto">
        {/* Image */}
        <div className="h-60 bg-gray-200 dark:bg-white/5 relative">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20">
              🍖
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="bg-black/50 backdrop-blur text-white px-3 py-1 rounded-lg text-xs font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
          <Link
            href="/recettes"
            className="absolute top-3 left-3 w-9 h-9 bg-black/50 backdrop-blur text-white rounded-full flex items-center justify-center text-sm hover:bg-black/70 transition"
          >
            ←
          </Link>
        </div>

        <div className="px-4 py-5">
          {/* Titre */}
          <h1 className="text-2xl font-black text-[#1C1512] dark:text-white leading-tight">
            {recipe.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {recipe.description}
          </p>

          {/* Infos rapides */}
          <div className="flex gap-4 mt-4 py-3 border-y border-gray-200/50 dark:border-white/[0.06]">
            <div className="text-center flex-1">
              <div className="text-lg font-extrabold text-[#1C1512] dark:text-white">
                {recipe.totalTime} min
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">Temps total</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg font-extrabold text-[#1C1512] dark:text-white">
                {recipe.servings}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">Personnes</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg font-extrabold text-[#1C1512] dark:text-white">
                {recipe.difficulty}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">Difficulté</div>
            </div>
          </div>

          {/* Commander les ingrédients */}
          <div className="mt-5 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-4">
            <div className="text-sm font-extrabold text-[#DC2626] flex items-center gap-2 mb-1">
              🛒 Commandez les ingrédients
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Retrouvez la viande nécessaire chez vos boucheries halal
              partenaires.
            </div>

            {meatIngredients.map((ing, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-white dark:bg-white/[0.03] rounded-xl mb-2 border border-red-50 dark:border-white/[0.06]"
              >
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-lg">
                  🥩
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#1C1512] dark:text-white">
                    {ing.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {ing.quantity} {ing.unit}
                  </div>
                  {shops.length > 0 && (
                    <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      Dispo chez {shops.length} boucherie
                      {shops.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                {shops.length > 0 && (
                  <Link
                    href={`/boutique/${shops[0].slug}`}
                    className="px-3 py-2 bg-[#DC2626] text-white rounded-lg text-xs font-bold hover:bg-[#b91c1c] transition"
                  >
                    Voir →
                  </Link>
                )}
              </div>
            ))}

            {shops.length > 1 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
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
            <h2 className="text-lg font-extrabold text-[#1C1512] dark:text-white mb-3">
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
                  <span className="w-5 text-center">
                    {ing.isMeat ? "🥩" : "•"}
                  </span>
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
            <h2 className="text-lg font-extrabold text-[#1C1512] dark:text-white mb-3">
              Préparation
            </h2>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.number} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#DC2626] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {step.number}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-0.5">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Badge IA */}
          <div className="mt-6 inline-flex items-center gap-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            Recette créée par l&apos;IA Klik&Go ·{" "}
            {new Date(recipe.publishedAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>

          {/* Recettes similaires */}
          {similar.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-white/[0.06]">
              <h3 className="text-sm font-extrabold text-[#1C1512] dark:text-white mb-3">
                Vous aimerez aussi
              </h3>
              <div
                className="flex gap-3 overflow-x-auto pb-2"
                style={{ scrollbarWidth: "none" }}
              >
                {similar.map((r) => (
                  <Link
                    key={r.id}
                    href={`/recettes/${r.slug}`}
                    className="min-w-[140px] flex-shrink-0 bg-white dark:bg-white/[0.03] rounded-xl border border-[#ece8e3]/60 dark:border-white/[0.06] overflow-hidden hover:shadow-sm transition"
                  >
                    <div className="h-20 bg-gray-200 dark:bg-white/5 overflow-hidden">
                      {r.imageUrl ? (
                        <img
                          src={r.imageUrl}
                          alt={r.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          🍖
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-bold text-[#1C1512] dark:text-white line-clamp-2">
                        {r.title}
                      </div>
                      <div className="text-[10px] text-[#DC2626] font-semibold mt-1">
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
              className="text-sm font-semibold text-[#DC2626] hover:text-[#b91c1c] transition"
            >
              ← Toutes les recettes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
