import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Update the wok recipe
  const result = await prisma.recipe.updateMany({
    where: { slug: { contains: "wok-de-b" } },
    data: { imageUrl: "/img/recipes/wok-boeuf.jpg" },
  });
  console.log(`Updated ${result.count} wok recipe(s)`);

  // Verify all recipes have local images
  const recipes = await prisma.recipe.findMany({
    select: { slug: true, imageUrl: true, title: true },
    orderBy: { publishedAt: "desc" },
  });
  for (const r of recipes) {
    const status = r.imageUrl?.startsWith("/img/") ? "✅" : "❌";
    console.log(`${status} ${r.slug} → ${r.imageUrl}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
