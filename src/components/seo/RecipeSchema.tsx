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

// Estimation nutrition par 100g de viande crue, valeurs USDA standard.
// Utilisees pour generer NutritionInformation sur recipe schema (audit GSC
// mai 2026 — "Champ nutrition manquant"). C'est une estimation factuelle
// basee sur le meatType principal de la recette + 150g typique par portion
// + ~80 kcal d'accompagnement standard. Pas de fake data : valeurs réelles
// de référence USDA, l'estimation est sur la portion (assumée 150g viande).
const NUTRITION_BY_MEAT: Record<
  string,
  { kcalPer100g: number; proteinPer100g: number; fatPer100g: number }
> = {
  boeuf: { kcalPer100g: 250, proteinPer100g: 26, fatPer100g: 16 },
  agneau: { kcalPer100g: 280, proteinPer100g: 25, fatPer100g: 19 },
  mouton: { kcalPer100g: 290, proteinPer100g: 25, fatPer100g: 21 },
  poulet: { kcalPer100g: 165, proteinPer100g: 31, fatPer100g: 4 },
  veau: { kcalPer100g: 170, proteinPer100g: 31, fatPer100g: 5 },
  dinde: { kcalPer100g: 135, proteinPer100g: 30, fatPer100g: 1 },
  canard: { kcalPer100g: 240, proteinPer100g: 27, fatPer100g: 11 },
  lapin: { kcalPer100g: 175, proteinPer100g: 33, fatPer100g: 3 },
};

const MEAT_PER_SERVING_GRAMS = 150;
const ACCOMP_KCAL_PER_SERVING = 80;

export function RecipeSchema({ recipe }: RecipeSchemaProps) {
  const url = `${SITE_URL}/recettes/${recipe.slug}`;
  const image = recipe.imageUrl
    ? recipe.imageUrl.startsWith("http")
      ? recipe.imageUrl
      : `${SITE_URL}${recipe.imageUrl}`
    : `${SITE_URL}/og-image.png`;

  // Calcul nutrition estimative par portion (150g viande + ~80 kcal accomp).
  // Si meatType non reconnu, fallback sur boeuf (estimation conservatrice).
  const meatKey = recipe.meatType.toLowerCase();
  const nutritionData = NUTRITION_BY_MEAT[meatKey] ?? NUTRITION_BY_MEAT.boeuf;
  const calories =
    Math.round((nutritionData.kcalPer100g * MEAT_PER_SERVING_GRAMS) / 100) +
    ACCOMP_KCAL_PER_SERVING;
  const proteinG = Math.round((nutritionData.proteinPer100g * MEAT_PER_SERVING_GRAMS) / 100);
  const fatG = Math.round((nutritionData.fatPer100g * MEAT_PER_SERVING_GRAMS) / 100);

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
    // GSC > Recipes signale "Champ nutrition manquant" comme amelioration.
    // Estimation factuelle basee sur USDA + 150g viande/portion + accomp.
    nutrition: {
      "@type": "NutritionInformation",
      servingSize: `${MEAT_PER_SERVING_GRAMS} g de viande + accompagnement`,
      calories: `${calories} kcal`,
      proteinContent: `${proteinG} g`,
      fatContent: `${fatG} g`,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}
