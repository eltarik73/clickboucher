// src/app/(client)/recettes/page.tsx — Liste des recettes halal IA
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { SafeImage } from "@/components/ui/SafeImage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Recettes halal — Idées de plats avec viande halal | Klik&Go",
  description:
    "Découvrez nos recettes halal avec des quantités de viande précises. Tajine, couscous, grillades, kefta et plus. Commandez les ingrédients en click & collect.",
  alternates: { canonical: `${SITE_URL}/recettes` },
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

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back + Hero */}
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft size={18} className="text-gray-700 dark:text-gray-300" />
          </Link>
          <h1 className="text-3xl font-black text-[#1C1512] dark:text-white">
            Nos recettes 🍖
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mt-1 pl-14">
          Des idées de plats avec les viandes de vos boucheries halal préférées.
        </p>

        {/* Filtres tags */}
        <div
          className="flex gap-2 overflow-x-auto py-4 -mx-4 px-4"
          style={{ scrollbarWidth: "none" }}
        >
          {TAGS.map((t) => (
            <Link
              key={t.id || "all"}
              href={t.id ? `/recettes?tag=${t.id}` : "/recettes"}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                tag === t.id || (!tag && !t.id)
                  ? "bg-[#DC2626] text-white"
                  : "bg-white dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:border-[#DC2626]"
              }`}
            >
              {t.icon ? `${t.icon} ` : ""}
              {t.label}
            </Link>
          ))}
        </div>

        {/* Recette du jour (featured) */}
        {featured && (
          <Link href={`/recettes/${featured.slug}`} className="block mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-md hover:shadow-lg transition border border-[#ece8e3]/60 dark:border-white/[0.06]">
              <div className="h-52 bg-gray-200 dark:bg-white/5 relative overflow-hidden">
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
                  <div className="w-full h-full flex items-center justify-center text-5xl">
                    🍖
                  </div>
                )}
                <div className="absolute top-3 left-3 bg-[#DC2626] text-white px-3 py-1 rounded-lg text-xs font-bold">
                  Recette du jour
                </div>
                <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur text-white px-3 py-1 rounded-lg text-xs font-semibold">
                  ⏱ {featured.totalTime} min
                </div>
              </div>
              <div className="p-4">
                <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white">
                  {featured.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{featured.description}</p>
                <div className="flex gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>👤 {featured.servings} pers.</span>
                  <span>📊 {featured.difficulty}</span>
                </div>
                {/* Viande nécessaire */}
                <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
                  <div className="text-xs font-bold text-[#DC2626]">
                    🥩 {featured.meatQuantity}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
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
              className="flex gap-3 bg-white dark:bg-gray-800 rounded-2xl p-3 border border-[#ece8e3]/60 dark:border-white/[0.06] hover:shadow-sm transition"
            >
              <div className="w-24 h-24 rounded-xl bg-gray-200 dark:bg-white/5 overflow-hidden flex-shrink-0 relative">
                {recipe.imageUrl ? (
                  <SafeImage
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🍖
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h3 className="font-bold text-sm text-[#1C1512] dark:text-white line-clamp-2">
                  {recipe.title}
                </h3>
                <div className="text-xs font-semibold text-[#DC2626] mt-1">
                  🥩 {recipe.meatQuantity}
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded">
                    ⏱ {recipe.totalTime} min
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded">
                    {recipe.difficulty}
                  </span>
                  {recipe.tags[0] && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded">
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
          <div className="text-center py-16">
            <div className="text-3xl mb-3">🍖</div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Aucune recette pour le moment
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              De nouvelles recettes sont ajoutées chaque jour !
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-4 py-2 bg-[#DC2626] text-white text-xs font-semibold rounded-full hover:bg-[#b91c1c] transition-colors"
            >
              Découvrir les boutiques
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
