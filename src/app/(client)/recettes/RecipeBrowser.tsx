"use client";

// Recipe list of /recettes, filtered by theme on the client. The page renders the whole list once
// (ISR): reading searchParams on the server would render it at every request (CLAUDE.md, « Coût
// CPU Vercel »). The ?tag= of the URL (footer links) is the one source of the theme it asks for:
// RecipeTagFromUrl reads it inside its own Suspense boundary, outside of which the list stays in
// the static HTML. A theme choice is written back with history.replaceState, without navigation.

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { RecipeTagFromUrl } from "./RecipeTagFromUrl";

/** What the page passes for each recipe: public, serialisable fields only. */
export type RecipeListItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  totalTime: number;
  servings: number;
  difficulty: string;
  meatQuantity: string;
  tags: string[];
  featured: boolean;
};

type Theme = { id: string; label: string; icon: string };

const THEMES: readonly Theme[] = [
  { id: "boeuf", label: "Bœuf", icon: "🐄" },
  { id: "agneau", label: "Agneau", icon: "🐑" },
  { id: "volaille", label: "Volaille", icon: "🍗" },
  { id: "veau", label: "Veau", icon: "🐂" },
  { id: "bbq", label: "BBQ", icon: "🔥" },
  { id: "ramadan", label: "Ramadan", icon: "🌙" },
  { id: "rapide", label: "Rapide", icon: "⏱" },
  { id: "famille", label: "Famille", icon: "👨‍👩‍👧‍👦" },
];

const SHORTCUTS: readonly { tag: string; label: string; text: string; icon: string }[] = [
  {
    tag: "ramadan",
    label: "Spécial Ramadan",
    text: "Plats de rupture du jeûne, harira, soupes, msemen sucrés-salés.",
    icon: "🌙",
  },
  {
    tag: "bbq",
    label: "BBQ & brochettes",
    text: "Brochettes de bœuf, agneau mariné, kefta — pour les beaux jours.",
    icon: "🔥",
  },
  {
    tag: "rapide",
    label: "Recettes rapides",
    text: "Des plats vite préparés, idéaux pour les soirs de semaine.",
    icon: "⏱",
  },
  {
    tag: "famille",
    label: "Plats famille",
    text: "Tajines, couscous, plats généreux pour 4 à 8 convives.",
    icon: "👨‍👩‍👧‍👦",
  },
];

function themeOf(tag: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === tag);
}

function chipClass(pressed: boolean): string {
  return pressed
    ? "bg-[#DC2626] text-white"
    : "border border-gray-200 bg-white text-gray-600 hover:border-[#DC2626] dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-400";
}

export function RecipeBrowser({ recipes }: { recipes: RecipeListItem[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const applyUrlTag = useCallback((requested: string | null) => {
    setTag(requested !== null && themeOf(requested) ? requested : null);
  }, []);

  function selectTag(next: string | null) {
    setTag(next);
    const url = new URL(window.location.href);
    if (next === null) url.searchParams.delete("tag");
    else url.searchParams.set("tag", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  if (recipes.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mb-3 text-3xl">🍖</div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Aucune recette pour le moment
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-[#DC2626] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c]"
        >
          Découvrir les boutiques
        </Link>
      </div>
    );
  }

  const visible = tag === null ? recipes : recipes.filter((r) => r.tags.includes(tag));
  const featured = visible.find((r) => r.featured) ?? visible[0];
  const others = visible.filter((r) => r !== featured);

  return (
    <>
      <Suspense fallback={null}>
        <RecipeTagFromUrl onTag={applyUrlTag} />
      </Suspense>
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#1C1512] dark:text-white">
          <ChefHat size={16} className="text-[#DC2626]" aria-hidden="true" />
          Nos univers de recettes halal
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.tag}
              type="button"
              aria-pressed={tag === shortcut.tag}
              onClick={() => selectTag(shortcut.tag)}
              className={`flex gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-[#DC2626] dark:bg-gray-800 ${
                tag === shortcut.tag
                  ? "border-[#DC2626]"
                  : "border-[#ece8e3] dark:border-white/[0.06]"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {shortcut.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#1C1512] dark:text-white">
                  {shortcut.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {shortcut.text}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div
        role="group"
        aria-label="Filtrer par thème"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 py-4"
        style={{ scrollbarWidth: "none" }}
      >
        <button
          type="button"
          aria-pressed={tag === null}
          onClick={() => selectTag(null)}
          className={`min-h-[44px] whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${chipClass(tag === null)}`}
        >
          Tout
        </button>
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            aria-pressed={tag === theme.id}
            onClick={() => selectTag(theme.id)}
            className={`min-h-[44px] whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${chipClass(tag === theme.id)}`}
          >
            <span aria-hidden="true">{theme.icon} </span>
            {theme.label}
          </button>
        ))}
      </div>

      {featured === undefined ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Aucune recette pour ce thème pour le moment.
          </p>
          <button
            type="button"
            onClick={() => selectTag(null)}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-[#DC2626] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c]"
          >
            Voir toutes les recettes
          </button>
        </div>
      ) : (
        <>
          <FeaturedRecipe recipe={featured} />
          <div className="space-y-3">
            {others.map((recipe) => (
              <RecipeRow key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function FeaturedRecipe({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link href={`/recettes/${recipe.slug}`} className="mb-6 block">
      <div className="overflow-hidden rounded-3xl border border-[#ece8e3]/60 bg-white shadow-md transition hover:shadow-lg dark:border-white/[0.06] dark:bg-gray-800">
        <div className="relative h-52 overflow-hidden bg-gray-200 dark:bg-white/5">
          {recipe.imageUrl ? (
            <SafeImage
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl">🍖</div>
          )}
          <div className="absolute left-3 top-3 rounded-lg bg-[#DC2626] px-3 py-1 text-xs font-bold text-white">
            À la une
          </div>
          <div className="absolute bottom-3 right-3 rounded-lg bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            ⏱ {recipe.totalTime} min
          </div>
        </div>
        <div className="p-4">
          <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white">{recipe.title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{recipe.description}</p>
          <div className="mt-3 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>👤 {recipe.servings} pers.</span>
            <span>📊 {recipe.difficulty}</span>
          </div>
          {/* text-[#991b1b] on bg-red-50: contrast ratio ~7, AA for small text. */}
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
            <div className="text-xs font-bold text-[#991b1b] dark:text-red-300">
              🥩 {recipe.meatQuantity}
            </div>
            <div className="mt-0.5 text-[10px] text-gray-700 dark:text-gray-300">
              À commander chez votre boucher, en click &amp; collect
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RecipeRow({ recipe }: { recipe: RecipeListItem }) {
  const firstTag = recipe.tags[0];
  return (
    <Link
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
        <div className="mt-1 text-xs font-semibold text-[#DC2626]">🥩 {recipe.meatQuantity}</div>
        <div className="mt-1 flex gap-2">
          <span className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/5 dark:text-gray-400">
            ⏱ {recipe.totalTime} min
          </span>
          <span className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/5 dark:text-gray-400">
            {recipe.difficulty}
          </span>
          {firstTag && (
            <span className="rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/5 dark:text-gray-400">
              {themeOf(firstTag)?.label ?? firstTag}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
