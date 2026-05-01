/**
 * Seed Recettes — Sprint 11 (mai 2026, audit annuaire local)
 *
 * Cible : 5 recettes prioritaires pour Recipe schema (rich snippet stars,
 * temps de cuisson, calories visibles dans SERP Google).
 *
 * Mots-clés cibles :
 * - "recette tajine agneau pruneaux" (1k-10k vol)
 * - "comment cuire merguez au four" (1k-10k vol)
 * - "marinade brochettes agneau halal" (1k-10k vol)
 * - "merguez airfryer" (100-1k vol, ZERO concurrence)
 * - "comment cuire gigot agneau" (1k-10k vol)
 *
 * Run : DATABASE_URL=... npx tsx prisma/seed-recipes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
  isMeat: boolean;
  productCategory?: string;
};

type Step = { number: number; text: string };

type RecipeSeed = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  difficulty: "Facile" | "Moyen" | "Difficile";
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  meatType: string;
  meatQuantity: string;
  sourceInspiration?: string;
  aiGenerated: boolean;
  featured: boolean;
};

const RECIPES: RecipeSeed[] = [
  {
    slug: "tajine-agneau-pruneaux-amandes",
    title: "Tajine d'agneau aux pruneaux et amandes",
    description:
      "Le tajine d'agneau aux pruneaux est le classique de la cuisine marocaine. Viande halal mijotée doucement avec épices, miel et fruits secs.",
    imageUrl: null,
    prepTime: 20,
    cookTime: 90,
    totalTime: 110,
    servings: 6,
    difficulty: "Facile",
    ingredients: [
      { name: "Épaule d'agneau halal en morceaux", quantity: "1.2", unit: "kg", isMeat: true, productCategory: "agneau" },
      { name: "Oignons", quantity: "2", unit: "pièces", isMeat: false },
      { name: "Pruneaux dénoyautés", quantity: "300", unit: "g", isMeat: false },
      { name: "Amandes émondées", quantity: "100", unit: "g", isMeat: false },
      { name: "Cannelle en bâton", quantity: "2", unit: "bâtons", isMeat: false },
      { name: "Cannelle en poudre", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Gingembre en poudre", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Safran", quantity: "1", unit: "pincée", isMeat: false },
      { name: "Miel", quantity: "3", unit: "c. à soupe", isMeat: false },
      { name: "Eau de fleur d'oranger", quantity: "1", unit: "c. à soupe", isMeat: false },
      { name: "Huile d'olive", quantity: "3", unit: "c. à soupe", isMeat: false },
      { name: "Sel, poivre", quantity: "", unit: "au goût", isMeat: false },
      { name: "Sésame grillé (déco)", quantity: "2", unit: "c. à soupe", isMeat: false },
    ],
    steps: [
      {
        number: 1,
        text: "Émincez les oignons. Dans un tajine ou cocotte, faites chauffer l'huile d'olive. Faites revenir les morceaux d'agneau halal de tous côtés pendant 5-7 minutes.",
      },
      {
        number: 2,
        text: "Ajoutez les oignons émincés, les bâtons de cannelle, la cannelle en poudre, le gingembre et le safran. Mélangez bien et laissez suer 3 minutes.",
      },
      {
        number: 3,
        text: "Couvrez la viande d'eau (jusqu'à hauteur). Salez, poivrez. Couvrez et laissez mijoter à feu doux pendant 1 heure.",
      },
      {
        number: 4,
        text: "Pendant ce temps, faites tremper les pruneaux dans de l'eau tiède 15 minutes. Faites griller les amandes à sec dans une poêle.",
      },
      {
        number: 5,
        text: "Ajoutez les pruneaux égouttés, le miel et l'eau de fleur d'oranger dans le tajine. Poursuivez la cuisson 30 minutes à feu très doux jusqu'à ce que la sauce devienne sirupeuse.",
      },
      {
        number: 6,
        text: "Servez le tajine d'agneau parsemé d'amandes grillées et de sésame, accompagné de semoule fine ou de pain marocain.",
      },
    ],
    tags: ["tajine", "agneau", "marocain", "halal", "famille", "fete"],
    meatType: "agneau",
    meatQuantity: "1.2 kg d'épaule d'agneau halal",
    aiGenerated: false,
    featured: true,
  },
  {
    slug: "merguez-au-four-cuisson-parfaite",
    title: "Merguez au four — cuisson parfaite en 20 min",
    description:
      "La méthode infaillible pour cuire les merguez halal au four sans qu'elles éclatent. Recette simple et savoureuse.",
    imageUrl: null,
    prepTime: 5,
    cookTime: 20,
    totalTime: 25,
    servings: 4,
    difficulty: "Facile",
    ingredients: [
      { name: "Merguez halal maison", quantity: "12", unit: "pièces", isMeat: true, productCategory: "charcuterie" },
      { name: "Huile d'olive", quantity: "1", unit: "c. à soupe", isMeat: false },
    ],
    steps: [
      { number: 1, text: "Préchauffez le four à 200°C (chaleur tournante). Sortez les merguez du frigo 15 minutes avant cuisson." },
      {
        number: 2,
        text: "Recouvrez une plaque de cuisson de papier sulfurisé. Disposez les merguez sans qu'elles se touchent. Badigeonnez très légèrement d'huile d'olive (optionnel).",
      },
      {
        number: 3,
        text: "Enfournez 10 minutes. À mi-cuisson, retournez chaque merguez avec une pince (jamais une fourchette pour ne pas percer la peau).",
      },
      {
        number: 4,
        text: "Continuez la cuisson 8-10 minutes supplémentaires jusqu'à ce qu'elles soient bien dorées et fermes au toucher. Vérifiez la cuisson en coupant une merguez en deux : la viande doit être homogène, sans rose.",
      },
      {
        number: 5,
        text: "Laissez reposer 2 minutes hors du four avant de servir. Accompagnez de pain pita, de salade méchouia ou de semoule.",
      },
    ],
    tags: ["merguez", "halal", "four", "rapide", "facile", "barbecue"],
    meatType: "merguez",
    meatQuantity: "12 merguez halal",
    aiGenerated: false,
    featured: true,
  },
  {
    slug: "merguez-airfryer-friteuse-air",
    title: "Merguez à l'airfryer — recette ultra rapide 12 min",
    description:
      "Cuisson des merguez halal à la friteuse à air (airfryer) : 12 minutes, sans matière grasse, peau croustillante.",
    imageUrl: null,
    prepTime: 2,
    cookTime: 12,
    totalTime: 14,
    servings: 2,
    difficulty: "Facile",
    ingredients: [
      { name: "Merguez halal", quantity: "6", unit: "pièces", isMeat: true, productCategory: "charcuterie" },
    ],
    steps: [
      {
        number: 1,
        text: "Préchauffez votre airfryer à 180°C pendant 3 minutes (selon modèle). Sortez les merguez du frigo 10 minutes avant.",
      },
      {
        number: 2,
        text: "Disposez les merguez dans le panier de l'airfryer sans qu'elles se chevauchent. Ne piquez surtout pas les merguez (elles perdraient leur jus).",
      },
      {
        number: 3,
        text: "Lancez la cuisson 6 minutes à 180°C. Ouvrez le tiroir et retournez les merguez avec une pince.",
      },
      {
        number: 4,
        text: "Poursuivez la cuisson 6 minutes supplémentaires. La peau doit être bien croustillante et dorée, l'intérieur ferme et chaud.",
      },
      {
        number: 5,
        text: "Servez immédiatement avec du pain frais, une salade et de la harissa. Idéal pour un déjeuner rapide ou une lunchbox.",
      },
    ],
    tags: ["merguez", "airfryer", "friteuse-air", "halal", "rapide", "facile", "lunch"],
    meatType: "merguez",
    meatQuantity: "6 merguez halal",
    aiGenerated: false,
    featured: false,
  },
  {
    slug: "marinade-brochettes-agneau-halal",
    title: "Marinade brochettes d'agneau halal — recette traditionnelle",
    description:
      "La marinade méditerranéenne classique pour des brochettes d'agneau halal tendres et parfumées. Repos 4h minimum.",
    imageUrl: null,
    prepTime: 15,
    cookTime: 12,
    totalTime: 27, // hors marinade
    servings: 6,
    difficulty: "Facile",
    ingredients: [
      { name: "Épaule d'agneau halal en cubes", quantity: "1", unit: "kg", isMeat: true, productCategory: "agneau" },
      { name: "Huile d'olive", quantity: "100", unit: "ml", isMeat: false },
      { name: "Jus de citron", quantity: "2", unit: "citrons", isMeat: false },
      { name: "Ail", quantity: "4", unit: "gousses", isMeat: false },
      { name: "Persil frais haché", quantity: "1/2", unit: "bouquet", isMeat: false },
      { name: "Cumin en poudre", quantity: "2", unit: "c. à café", isMeat: false },
      { name: "Coriandre en poudre", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Paprika doux", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Origan séché", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Sel, poivre noir moulu", quantity: "", unit: "au goût", isMeat: false },
      { name: "Oignons rouges", quantity: "2", unit: "pièces", isMeat: false },
      { name: "Poivrons (déco)", quantity: "2", unit: "pièces", isMeat: false },
    ],
    steps: [
      {
        number: 1,
        text: "Découpez l'épaule d'agneau halal en cubes de 3-4 cm. Réservez dans un grand saladier.",
      },
      {
        number: 2,
        text: "Préparez la marinade : émincez l'ail, hachez le persil. Dans un bol, mélangez huile d'olive, jus de citron, ail, persil, cumin, coriandre, paprika, origan, sel et poivre.",
      },
      {
        number: 3,
        text: "Versez la marinade sur les cubes d'agneau. Mélangez bien pour enrober chaque morceau. Couvrez et laissez mariner au frigo minimum 4 heures, idéalement 12 heures (la nuit).",
      },
      {
        number: 4,
        text: "Le jour de la cuisson, sortez la viande 30 min avant. Coupez les oignons rouges et les poivrons en gros morceaux. Embrochez en alternant viande, oignon, poivron.",
      },
      {
        number: 5,
        text: "Cuisson au barbecue : 3-4 minutes par face à feu vif (12 minutes total). Au four : 200°C pendant 15 minutes en retournant à mi-cuisson. À la plancha : feu moyen-vif, 4 minutes par face.",
      },
      {
        number: 6,
        text: "Laissez reposer 2 minutes avant de servir. Accompagnez de tzatziki, pain pita, salade méditerranéenne et semoule.",
      },
    ],
    tags: ["brochettes", "agneau", "marinade", "halal", "barbecue", "mediterraneen"],
    meatType: "agneau",
    meatQuantity: "1 kg d'épaule d'agneau halal en cubes",
    aiGenerated: false,
    featured: true,
  },
  {
    slug: "gigot-agneau-au-four-cuisson",
    title: "Gigot d'agneau halal au four — cuisson parfaite",
    description:
      "Le gigot d'agneau halal au four en cuisson rosée : 25 min/kg à 180°C. Recette simple avec ail, romarin et huile d'olive.",
    imageUrl: null,
    prepTime: 15,
    cookTime: 75, // pour 2.5kg
    totalTime: 90,
    servings: 8,
    difficulty: "Facile",
    ingredients: [
      { name: "Gigot d'agneau halal avec os", quantity: "2.5", unit: "kg", isMeat: true, productCategory: "agneau" },
      { name: "Ail", quantity: "10", unit: "gousses", isMeat: false },
      { name: "Romarin frais", quantity: "4", unit: "branches", isMeat: false },
      { name: "Thym frais", quantity: "4", unit: "branches", isMeat: false },
      { name: "Huile d'olive", quantity: "5", unit: "c. à soupe", isMeat: false },
      { name: "Fleur de sel", quantity: "1", unit: "c. à soupe", isMeat: false },
      { name: "Poivre noir mignonette", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Vin blanc sec ou bouillon", quantity: "200", unit: "ml", isMeat: false },
    ],
    steps: [
      {
        number: 1,
        text: "Sortez le gigot du frigo 1h avant cuisson (essentiel pour une cuisson homogène). Préchauffez le four à 180°C (chaleur tournante).",
      },
      {
        number: 2,
        text: "Pelez 6 gousses d'ail et coupez-les en bâtonnets. Avec la pointe d'un couteau, faites des incisions dans le gigot et glissez-y les éclats d'ail et de petites branches de romarin.",
      },
      {
        number: 3,
        text: "Frottez généreusement le gigot d'huile d'olive. Salez à la fleur de sel et poivrez. Disposez le gigot dans un plat allant au four.",
      },
      {
        number: 4,
        text: "Ajoutez les 4 gousses d'ail restantes (en chemise) et les branches de thym dans le plat autour du gigot. Versez le vin blanc ou bouillon dans le fond du plat.",
      },
      {
        number: 5,
        text: "Enfournez : comptez 25 minutes par kg pour une cuisson rosée à cœur (60-65°C au thermomètre), 30 min/kg pour cuisson à point. Pour 2.5 kg : environ 1h05 à 1h15. Arrosez 2-3 fois pendant la cuisson avec le jus.",
      },
      {
        number: 6,
        text: "Sortez le gigot et laissez reposer 15 minutes sous une feuille d'aluminium AVANT de découper. Cette étape est cruciale pour que le jus se redistribue dans la viande.",
      },
      {
        number: 7,
        text: "Découpez en tranches fines en commençant par la noix. Servez avec le jus de cuisson, des pommes de terre rôties et des haricots verts ou des flageolets.",
      },
    ],
    tags: ["gigot", "agneau", "four", "halal", "fete", "famille", "paques", "aid"],
    meatType: "agneau",
    meatQuantity: "1 gigot d'agneau halal de 2,5 kg",
    aiGenerated: false,
    featured: true,
  },
];

async function main() {
  console.log("🌱 Seeding 5 recettes halal pour SEO Sprint 11...");

  for (const recipe of RECIPES) {
    const existing = await prisma.recipe.findUnique({ where: { slug: recipe.slug } });
    if (existing) {
      console.log(`⏭️  Skip ${recipe.slug} (existe déjà)`);
      continue;
    }
    await prisma.recipe.create({
      data: {
        slug: recipe.slug,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        totalTime: recipe.totalTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ingredients: recipe.ingredients as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        steps: recipe.steps as any,
        tags: recipe.tags,
        meatType: recipe.meatType,
        meatQuantity: recipe.meatQuantity,
        aiGenerated: recipe.aiGenerated,
        featured: recipe.featured,
        published: true,
      },
    });
    console.log(`✅ Créé : ${recipe.slug}`);
  }

  const count = await prisma.recipe.count({ where: { published: true } });
  console.log(`\n🎉 Total recettes publiées : ${count}`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed recettes :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
