// src/lib/recipe-generator.ts — AI recipe generation using Anthropic API
import prisma from "@/lib/prisma";

// ── Pool d'images food Unsplash CDN (URLs permanentes) ──
const MEAT_IMAGES: Record<string, string[]> = {
  boeuf: [
    "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1024&h=680&fit=crop&q=80",
  ],
  agneau: [
    "https://images.unsplash.com/photo-1511690743698-d9d18f7e20f1?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1574484284002-952d92456975?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1457460866886-40ef8d4b42a0?w=1024&h=680&fit=crop&q=80",
  ],
  volaille: [
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1561651188-d207bbec4ec3?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1598103442097-8b74f5ef00ad?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=1024&h=680&fit=crop&q=80",
  ],
  veau: [
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1024&h=680&fit=crop&q=80",
    "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=1024&h=680&fit=crop&q=80",
  ],
};

function pickRecipeImage(meatType: string): string {
  const pool = MEAT_IMAGES[meatType] || MEAT_IMAGES.boeuf;
  return pool[Math.floor(Math.random() * pool.length)];
}

const MEAT_TYPES = ["boeuf", "agneau", "volaille", "veau"];
const OCCASIONS = ["quotidien", "ramadan", "bbq", "famille", "rapide", "fête"];
const SEASONS: Record<number, string> = {
  1: "hiver", 2: "hiver", 3: "printemps", 4: "printemps",
  5: "printemps", 6: "été", 7: "été", 8: "été",
  9: "automne", 10: "automne", 11: "automne", 12: "hiver",
};

export async function generateDailyRecipe() {
  const meatType = MEAT_TYPES[Math.floor(Math.random() * MEAT_TYPES.length)];
  const occasion = OCCASIONS[Math.floor(Math.random() * OCCASIONS.length)];
  const month = new Date().getMonth() + 1;
  const season = SEASONS[month];

  // Vérifier les recettes récentes pour éviter les doublons
  const recentRecipes = await prisma.recipe.findMany({
    where: { publishedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
    select: { title: true, meatType: true },
    orderBy: { publishedAt: "desc" },
    take: 14,
  });
  const recentTitles = recentRecipes.map((r) => r.title).join(", ");

  // Récupérer les produits disponibles sur la plateforme
  const availableProducts = await prisma.product.findMany({
    where: { inStock: true, isActive: true, shop: { visible: true } },
    select: { name: true, priceCents: true },
    distinct: ["name"],
    take: 30,
  });
  const productNames = availableProducts.map((p) => p.name).join(", ");

  // Appeler l'API Claude pour générer la recette
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
        },
      ],
      messages: [
        {
          role: "user",
          content: `Tu es un chef cuisinier spécialisé en cuisine halal. Cherche sur internet une recette populaire et tendance avec de la viande de ${meatType}, adaptée à la saison ${season} et l'occasion "${occasion}".

IMPORTANT :
- Cherche d'abord sur le web pour t'inspirer des recettes tendances
- Réécris COMPLÈTEMENT la recette dans tes propres mots (ne copie jamais mot pour mot)
- Les quantités de viande doivent être PRÉCISES en grammes ou kg (ex: "800g de viande hachée", "1,2 kg d'épaule d'agneau")
- Adapte les quantités pour 4 à 6 personnes
- La viande doit être HALAL
- Les ingrédients non-viande sont secondaires mais inclus

Produits disponibles chez nos boucheries partenaires : ${productNames}

Recettes récentes (NE PAS refaire) : ${recentTitles || "aucune"}

Réponds UNIQUEMENT en JSON valide, sans backticks, sans preamble :
{
  "title": "Titre accrocheur de la recette",
  "description": "Description appétissante en 2 phrases max",
  "prepTime": 20,
  "cookTime": 45,
  "servings": 4,
  "difficulty": "Facile",
  "meatType": "${meatType}",
  "meatQuantity": "800g viande hachée bœuf",
  "tags": ["boeuf", "rapide"],
  "ingredients": [
    { "name": "Viande hachée de bœuf halal", "quantity": "800", "unit": "g", "isMeat": true, "productCategory": "boeuf" },
    { "name": "Oignons", "quantity": "2", "unit": "pièces", "isMeat": false }
  ],
  "steps": [
    { "number": 1, "text": "Instruction détaillée avec quantités de viande en gras..." }
  ]
}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Extraire le texte de la réponse (peut contenir des tool_use pour web_search)
  const textContent = data.content?.find((c: { type: string }) => c.type === "text");
  if (!textContent) throw new Error("Pas de réponse texte de Claude");

  // Parser le JSON
  const recipeData = JSON.parse(
    textContent.text.replace(/```json|```/g, "").trim()
  );

  // Générer le slug
  const slug = recipeData.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Vérifier que le slug n'existe pas déjà
  const existing = await prisma.recipe.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  // Image pour la recette (pool Unsplash CDN)
  const imageUrl = pickRecipeImage(meatType);

  // Sauvegarder en DB
  const recipe = await prisma.recipe.create({
    data: {
      slug: finalSlug,
      title: recipeData.title,
      description: recipeData.description,
      imageUrl,
      prepTime: recipeData.prepTime,
      cookTime: recipeData.cookTime,
      totalTime: recipeData.prepTime + recipeData.cookTime,
      servings: recipeData.servings,
      difficulty: recipeData.difficulty,
      meatType: recipeData.meatType,
      meatQuantity: recipeData.meatQuantity,
      tags: recipeData.tags,
      ingredients: recipeData.ingredients,
      steps: recipeData.steps,
      sourceInspiration: `${meatType} ${occasion} ${season}`,
      published: true,
      featured: true,
    },
  });

  // Retirer le featured des anciennes recettes
  await prisma.recipe.updateMany({
    where: { id: { not: recipe.id }, featured: true },
    data: { featured: false },
  });

  console.log(`[RECIPE] Recette générée : "${recipe.title}" (${recipe.slug})`);
  return recipe;
}
