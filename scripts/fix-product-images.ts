// scripts/fix-product-images.ts — Update all product imageUrls in DB
// Run: npx tsx scripts/fix-product-images.ts

import { PrismaClient } from "@prisma/client";
import { resolveProductImage } from "../src/lib/product-images";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    include: { category: { select: { name: true } } },
  });

  console.log(`Found ${products.length} products to update...\n`);

  let updated = 0;
  for (const product of products) {
    const correctImage = resolveProductImage({
      name: product.name,
      imageUrl: null, // force recalcul
      category: product.category.name,
    });

    if (product.imageUrl !== correctImage) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: correctImage },
      });
      console.log(`  ${product.name} → ${correctImage.substring(0, 70)}...`);
      updated++;
    }
  }

  console.log(`\n${updated}/${products.length} produits mis à jour !`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  prisma.$disconnect();
  process.exit(1);
});
