// scripts/fix-recipe-images.ts — Fix broken recipe imageUrls to use local images
// Run: npx tsx scripts/fix-recipe-images.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MEAT_IMAGES: Record<string, string[]> = {
  boeuf: ["/img/recipes/kefta-grillee.jpg", "/img/recipes/brochettes-merguez.jpg"],
  agneau: ["/img/recipes/tajine-agneau.jpg", "/img/recipes/couscous-royal.jpg", "/img/recipes/epaule-agneau.jpg"],
  volaille: ["/img/recipes/shawarma-poulet.jpg", "/img/recipes/eminces-poulet.jpg"],
  veau: ["/img/recipes/tajine-agneau.jpg", "/img/recipes/kefta-grillee.jpg", "/img/recipes/couscous-royal.jpg"],
};

const ALL_IMAGES = [
  "/img/recipes/kefta-grillee.jpg",
  "/img/recipes/brochettes-merguez.jpg",
  "/img/recipes/tajine-agneau.jpg",
  "/img/recipes/couscous-royal.jpg",
  "/img/recipes/epaule-agneau.jpg",
  "/img/recipes/shawarma-poulet.jpg",
  "/img/recipes/eminces-poulet.jpg",
  "/img/recipes/wok-boeuf.jpg",
];

function pickImage(meatType: string, index: number): string {
  const pool = MEAT_IMAGES[meatType] || ALL_IMAGES;
  return pool[index % pool.length];
}

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: { id: true, title: true, imageUrl: true, meatType: true },
  });

  console.log(`Found ${recipes.length} recipes`);
  let fixed = 0;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const isLocal = recipe.imageUrl?.startsWith("/img/recipes/");
    const isBroken = !recipe.imageUrl || !isLocal;

    if (isBroken) {
      const newUrl = pickImage(recipe.meatType || "boeuf", i);
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { imageUrl: newUrl },
      });
      console.log(`Fixed: "${recipe.title}" — ${recipe.imageUrl || "null"} → ${newUrl}`);
      fixed++;
    } else {
      console.log(`OK: "${recipe.title}" — ${recipe.imageUrl}`);
    }
  }

  console.log(`\nDone: ${fixed} fixed, ${recipes.length - fixed} already OK`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
