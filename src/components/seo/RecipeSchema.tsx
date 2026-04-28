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
    recipeIngredient: recipe.ingredients.map((i) =>
      [i.quantity, i.unit, i.name].filter(Boolean).join(" ").trim()
    ),
    recipeInstructions: recipe.steps.map((s) => ({
      "@type": "HowToStep",
      position: s.number,
      text: s.text,
    })),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
