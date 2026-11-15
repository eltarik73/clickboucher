import { JsonLd } from "@/components/seo/JsonLd";

type Ingredient = { name: string; quantity: string; unit: string };
type Step = { number: number; text: string };

type RecipeSchemaProps = {
  recipe: {
    slug: string;
    title: string;
    description: string;
    imageUrl: string | null;
    prepTime: number;
    cookTime: number;
    totalTime: number;
    servings: number;
    difficulty: string;
    ingredients: Ingredient[];
    steps: Step[];
    tags: string[];
    meatType: string;
    publishedAt: Date | string;
    updatedAt: Date | string;
  };
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

const toIso = (mins: number) => `PT${mins}M`;

// No nutrition block: a recipe stores no nutrition facts, and figures derived from constants (a
// fixed portion of meat, a fixed side dish) would be structured data the page cannot back.
export function RecipeSchema({ recipe }: RecipeSchemaProps) {
  const url = `${SITE_URL}/recettes/${recipe.slug}`;
  const image = recipe.imageUrl
    ? recipe.imageUrl.startsWith("http")
      ? recipe.imageUrl
      : `${SITE_URL}${recipe.imageUrl}`
    : `${SITE_URL}/og-image.png`;

  const json = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.description,
    image: [image],
    author: { "@type": "Organization", name: "Klik&Go" },
    datePublished: new Date(recipe.publishedAt).toISOString(),
    dateModified: new Date(recipe.updatedAt).toISOString(),
    prepTime: toIso(recipe.prepTime),
    cookTime: toIso(recipe.cookTime),
    totalTime: toIso(recipe.totalTime),
    recipeYield: `${recipe.servings} personnes`,
    recipeCategory: "Plat principal",
    recipeCuisine: "Halal",
    keywords: [...recipe.tags, "recette halal", recipe.meatType, "viande halal"].join(", "),
    // Schema.org valid + Google understands HalalDiet for restricted-diet
    // recommendations (audit GSC mai 2026).
    suitableForDiet: "https://schema.org/HalalDiet",
    recipeIngredient: recipe.ingredients.map((i) =>
      [i.quantity, i.unit, i.name].filter(Boolean).join(" ").trim()
    ),
    // GSC > Recipes signale "Vous devez indiquer image ou video dans
    // recipeInstructions" comme amelioration. On reutilise l'image principale
    // de la recette dans chaque step — c'est la meme image illustrative
    // (factuelle, pas fake), conforme aux guidelines Google 2026.
    recipeInstructions: recipe.steps.map((s) => ({
      "@type": "HowToStep",
      position: s.number,
      name: `Étape ${s.number}`,
      text: s.text,
      url: `${url}#step-${s.number}`,
      image,
    })),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };

  return <JsonLd data={json} />;
}
