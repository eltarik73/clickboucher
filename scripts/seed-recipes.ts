// scripts/seed-recipes.ts — Seed 5 recettes halal pour la page /recettes
// Run: npx tsx scripts/seed-recipes.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RECIPES = [
  {
    slug: "tajine-agneau-pruneaux",
    title: "Tajine d'agneau aux pruneaux",
    description:
      "Un classique marocain fondant et sucré-salé. L'agneau mijoté lentement avec des pruneaux, des amandes et des épices douces. Un plat réconfortant parfait pour les grandes tablées.",
    prepTime: 25,
    cookTime: 120,
    totalTime: 145,
    servings: 6,
    difficulty: "Moyen",
    meatType: "agneau",
    meatQuantity: "1,2 kg d'épaule d'agneau",
    tags: ["agneau", "famille", "ramadan"],
    featured: true,
    ingredients: [
      { name: "Épaule d'agneau", quantity: "1,2", unit: "kg", isMeat: true, productCategory: "agneau" },
      { name: "Pruneaux dénoyautés", quantity: "250", unit: "g", isMeat: false },
      { name: "Oignons", quantity: "3", unit: "pièces", isMeat: false },
      { name: "Amandes entières", quantity: "100", unit: "g", isMeat: false },
      { name: "Miel", quantity: "3", unit: "c. à soupe", isMeat: false },
      { name: "Cannelle", quantity: "2", unit: "c. à café", isMeat: false },
      { name: "Gingembre moulu", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Safran", quantity: "1", unit: "pincée", isMeat: false },
      { name: "Huile d'olive", quantity: "4", unit: "c. à soupe", isMeat: false },
      { name: "Sel et poivre", quantity: "", unit: "", isMeat: false },
      { name: "Graines de sésame", quantity: "2", unit: "c. à soupe", isMeat: false },
    ],
    steps: [
      { number: 1, text: "Coupez l'épaule d'agneau en gros morceaux. Assaisonnez avec sel, poivre, cannelle et gingembre." },
      { number: 2, text: "Dans un faitout ou tajine, faites revenir la viande dans l'huile d'olive jusqu'à coloration dorée sur toutes les faces." },
      { number: 3, text: "Ajoutez les oignons émincés et laissez fondre 5 minutes. Ajoutez le safran dilué dans un peu d'eau chaude." },
      { number: 4, text: "Couvrez d'eau à hauteur. Portez à ébullition puis baissez le feu. Laissez mijoter à couvert pendant 1h30." },
      { number: 5, text: "Pendant ce temps, faites tremper les pruneaux 15 minutes dans de l'eau tiède. Faites dorer les amandes à sec dans une poêle." },
      { number: 6, text: "Ajoutez les pruneaux égouttés et le miel dans le tajine. Poursuivez la cuisson 30 minutes à feu doux." },
      { number: 7, text: "Servez garni d'amandes grillées et de graines de sésame. Accompagnez de semoule ou de pain." },
    ],
    sourceInspiration: "Cuisine traditionnelle marocaine",
  },
  {
    slug: "brochettes-merguez-maison",
    title: "Brochettes merguez maison",
    description:
      "Des merguez faites maison, juteuses et bien épicées, grillées au barbecue ou à la plancha. Plus savoureuses que celles du commerce, avec un mélange d'épices authentique.",
    prepTime: 30,
    cookTime: 15,
    totalTime: 45,
    servings: 4,
    difficulty: "Facile",
    meatType: "boeuf",
    meatQuantity: "600 g de viande hachée (boeuf/agneau)",
    tags: ["boeuf", "bbq", "rapide"],
    featured: false,
    ingredients: [
      { name: "Viande hachée boeuf", quantity: "400", unit: "g", isMeat: true, productCategory: "boeuf" },
      { name: "Viande hachée agneau", quantity: "200", unit: "g", isMeat: true, productCategory: "agneau" },
      { name: "Harissa", quantity: "2", unit: "c. à soupe", isMeat: false },
      { name: "Cumin moulu", quantity: "2", unit: "c. à café", isMeat: false },
      { name: "Paprika fumé", quantity: "1", unit: "c. à soupe", isMeat: false },
      { name: "Ail", quantity: "4", unit: "gousses", isMeat: false },
      { name: "Persil frais", quantity: "1", unit: "bouquet", isMeat: false },
      { name: "Huile d'olive", quantity: "2", unit: "c. à soupe", isMeat: false },
      { name: "Sel", quantity: "1", unit: "c. à café", isMeat: false },
    ],
    steps: [
      { number: 1, text: "Mélangez les deux viandes hachées dans un grand saladier. Ajoutez l'ail pressé et le persil finement ciselé." },
      { number: 2, text: "Incorporez la harissa, le cumin, le paprika fumé, le sel et l'huile d'olive. Malaxez bien pendant 3-4 minutes." },
      { number: 3, text: "Laissez reposer la préparation au frais 30 minutes minimum (idéal : 2h)." },
      { number: 4, text: "Formez des boudins autour de pics à brochette, ou directement des saucisses à la main." },
      { number: 5, text: "Grillez au barbecue, à la plancha ou au four (grill 220°C) pendant 12-15 minutes en retournant régulièrement." },
      { number: 6, text: "Servez avec du pain, de la salade, des tomates et de la sauce harissa." },
    ],
    sourceInspiration: "Cuisine maghrébine — BBQ",
  },
  {
    slug: "couscous-royal-legumes",
    title: "Couscous royal aux légumes",
    description:
      "Le roi des plats familiaux ! Un couscous généreux avec trois viandes (poulet, agneau, merguez), un bouillon parfumé aux épices et des légumes de saison fondants.",
    prepTime: 40,
    cookTime: 90,
    totalTime: 130,
    servings: 8,
    difficulty: "Moyen",
    meatType: "agneau",
    meatQuantity: "500 g d'agneau + 4 cuisses de poulet + 8 merguez",
    tags: ["agneau", "volaille", "famille", "ramadan"],
    featured: false,
    ingredients: [
      { name: "Épaule d'agneau en morceaux", quantity: "500", unit: "g", isMeat: true, productCategory: "agneau" },
      { name: "Cuisses de poulet", quantity: "4", unit: "pièces", isMeat: true, productCategory: "volaille" },
      { name: "Merguez", quantity: "8", unit: "pièces", isMeat: true, productCategory: "merguez" },
      { name: "Semoule moyenne", quantity: "500", unit: "g", isMeat: false },
      { name: "Carottes", quantity: "4", unit: "pièces", isMeat: false },
      { name: "Courgettes", quantity: "3", unit: "pièces", isMeat: false },
      { name: "Navets", quantity: "3", unit: "pièces", isMeat: false },
      { name: "Pois chiches (trempés)", quantity: "200", unit: "g", isMeat: false },
      { name: "Tomates", quantity: "3", unit: "pièces", isMeat: false },
      { name: "Concentré de tomate", quantity: "2", unit: "c. à soupe", isMeat: false },
      { name: "Ras el hanout", quantity: "2", unit: "c. à soupe", isMeat: false },
      { name: "Huile d'olive", quantity: "4", unit: "c. à soupe", isMeat: false },
      { name: "Beurre", quantity: "50", unit: "g", isMeat: false },
    ],
    steps: [
      { number: 1, text: "Faites revenir l'agneau et le poulet dans l'huile d'olive dans une grande marmite. Salez, poivrez et ajoutez le ras el hanout." },
      { number: 2, text: "Ajoutez les oignons émincés, les tomates concassées et le concentré de tomate. Mélangez bien." },
      { number: 3, text: "Couvrez d'eau (environ 3 litres). Ajoutez les pois chiches. Portez à ébullition puis baissez à feu moyen. Laissez cuire 45 minutes." },
      { number: 4, text: "Ajoutez les carottes et navets coupés en gros morceaux. Poursuivez 20 minutes." },
      { number: 5, text: "Ajoutez les courgettes coupées en tronçons. Continuez 15 minutes. Rectifiez l'assaisonnement du bouillon." },
      { number: 6, text: "Préparez la semoule : versez de l'eau bouillante salée sur la semoule (1 volume semoule / 1 volume eau). Couvrez 5 min, égrainez avec du beurre." },
      { number: 7, text: "Grillez les merguez à la poêle ou au four pendant 10 minutes." },
      { number: 8, text: "Dressez : semoule au centre, viandes et légumes par-dessus, merguez autour. Servez le bouillon à part." },
    ],
    sourceInspiration: "Cuisine algérienne traditionnelle",
  },
  {
    slug: "shawarma-poulet-maison",
    title: "Shawarma poulet fait maison",
    description:
      "Le shawarma emblématique du street food libanais, version maison au four. Poulet mariné aux épices orientales, tranché finement et servi en wrap avec sauce blanche et crudités.",
    prepTime: 20,
    cookTime: 35,
    totalTime: 55,
    servings: 4,
    difficulty: "Facile",
    meatType: "volaille",
    meatQuantity: "800 g de cuisses de poulet désossées",
    tags: ["volaille", "rapide"],
    featured: false,
    ingredients: [
      { name: "Cuisses de poulet désossées", quantity: "800", unit: "g", isMeat: true, productCategory: "volaille" },
      { name: "Yaourt nature", quantity: "150", unit: "g", isMeat: false },
      { name: "Jus de citron", quantity: "3", unit: "c. à soupe", isMeat: false },
      { name: "Cumin moulu", quantity: "2", unit: "c. à café", isMeat: false },
      { name: "Paprika", quantity: "1", unit: "c. à soupe", isMeat: false },
      { name: "Curcuma", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Cannelle", quantity: "0,5", unit: "c. à café", isMeat: false },
      { name: "Ail", quantity: "3", unit: "gousses", isMeat: false },
      { name: "Pain pita ou wrap", quantity: "4", unit: "pièces", isMeat: false },
      { name: "Tomates", quantity: "2", unit: "pièces", isMeat: false },
      { name: "Oignon rouge", quantity: "1", unit: "pièce", isMeat: false },
      { name: "Salade", quantity: "1", unit: "pièce", isMeat: false },
      { name: "Sauce blanche (tahini ou yaourt)", quantity: "100", unit: "ml", isMeat: false },
    ],
    steps: [
      { number: 1, text: "Mélangez le yaourt, le jus de citron, l'ail pressé et toutes les épices pour faire la marinade." },
      { number: 2, text: "Coupez le poulet en fines lamelles. Enrobez-les de marinade. Réfrigérez minimum 1h (idéal : une nuit)." },
      { number: 3, text: "Préchauffez le four à 220°C. Étalez le poulet mariné sur une plaque recouverte de papier sulfurisé." },
      { number: 4, text: "Enfournez 25-30 minutes en retournant à mi-cuisson, jusqu'à ce que le poulet soit doré et légèrement caramélisé." },
      { number: 5, text: "Préparez les garnitures : tomates en dés, oignon émincé finement, feuilles de salade." },
      { number: 6, text: "Réchauffez les pains pita 1-2 minutes au four. Garnissez de poulet, crudités et sauce blanche. Roulez et servez." },
    ],
    sourceInspiration: "Street food libanais",
  },
  {
    slug: "kefta-grillee-epices",
    title: "Kefta grillée aux épices",
    description:
      "Des boulettes de viande hachée parfumées au persil, à la coriandre et au cumin, grillées à la perfection. Un classique du barbecue maghrébin, rapide et délicieux.",
    prepTime: 15,
    cookTime: 12,
    totalTime: 27,
    servings: 4,
    difficulty: "Facile",
    meatType: "boeuf",
    meatQuantity: "500 g de viande hachée de boeuf",
    tags: ["boeuf", "bbq", "rapide"],
    featured: false,
    ingredients: [
      { name: "Viande hachée de boeuf", quantity: "500", unit: "g", isMeat: true, productCategory: "boeuf" },
      { name: "Oignon", quantity: "1", unit: "pièce", isMeat: false },
      { name: "Persil frais", quantity: "1", unit: "bouquet", isMeat: false },
      { name: "Coriandre fraîche", quantity: "0,5", unit: "bouquet", isMeat: false },
      { name: "Cumin moulu", quantity: "2", unit: "c. à café", isMeat: false },
      { name: "Paprika", quantity: "1", unit: "c. à café", isMeat: false },
      { name: "Cannelle", quantity: "0,5", unit: "c. à café", isMeat: false },
      { name: "Sel et poivre", quantity: "", unit: "", isMeat: false },
      { name: "Huile d'olive", quantity: "1", unit: "c. à soupe", isMeat: false },
    ],
    steps: [
      { number: 1, text: "Râpez finement l'oignon. Ciselez le persil et la coriandre très finement." },
      { number: 2, text: "Dans un saladier, mélangez la viande hachée, l'oignon, les herbes, le cumin, le paprika, la cannelle, le sel et le poivre." },
      { number: 3, text: "Malaxez la préparation 2-3 minutes pour bien homogénéiser. Laissez reposer 15 min au frais." },
      { number: 4, text: "Formez des boulettes allongées autour de brochettes plates, ou des boulettes rondes à la main." },
      { number: 5, text: "Grillez au barbecue, à la poêle ou au four (grill 220°C) pendant 10-12 minutes en retournant à mi-cuisson." },
      { number: 6, text: "Servez avec du pain chaud, une salade de tomates-concombres et de la sauce au yaourt." },
    ],
    sourceInspiration: "Cuisine marocaine — BBQ",
  },
];

async function main() {
  console.log("Seeding 5 recipes...");

  for (const recipe of RECIPES) {
    const existing = await prisma.recipe.findUnique({
      where: { slug: recipe.slug },
    });

    if (existing) {
      console.log(`  - "${recipe.title}" already exists, updating...`);
      await prisma.recipe.update({
        where: { slug: recipe.slug },
        data: recipe,
      });
    } else {
      console.log(`  + Creating "${recipe.title}"...`);
      await prisma.recipe.create({ data: recipe });
    }
  }

  console.log("Done! 5 recipes seeded.");
}

main()
  .catch((e) => {
    console.error("Error seeding recipes:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
