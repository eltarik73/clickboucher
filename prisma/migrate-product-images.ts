// ═══════════════════════════════════════════════
// KLIK&GO — Migrate product images (update only)
// Only updates imageUrl on existing products by fuzzy name match.
// Does NOT create or delete any product.
// Usage: npx tsx prisma/migrate-product-images.ts
// ═══════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Mapping: keywords → local image path ──
// Order matters: longer/more specific keywords first to avoid false matches
const IMAGE_MAP: { keywords: string[]; imageUrl: string }[] = [
  // ── BOEUF ──
  { keywords: ["bavette"],                       imageUrl: "/img/products/bavette-aloyau.jpg" },
  { keywords: ["entrecote", "entrecôte"],        imageUrl: "/img/products/entrecote-boeuf.jpg" },
  { keywords: ["onglet"],                        imageUrl: "/img/products/onglet-boeuf.jpg" },
  { keywords: ["roti de boeuf", "rôti de boeuf", "roti de bœuf", "rôti de bœuf"], imageUrl: "/img/products/roti-boeuf-extra.jpg" },
  { keywords: ["tournedos"],                     imageUrl: "/img/products/tournedos-boeuf.jpg" },
  { keywords: ["rond de gite", "rond de gîte"],  imageUrl: "/img/products/rond-de-gite.jpg" },
  { keywords: ["viande hachee", "viande hachée"], imageUrl: "/img/products/viande-hachee.jpg" },
  { keywords: ["steak hache", "steak haché"],    imageUrl: "/img/products/steak-hache.jpg" },
  { keywords: ["brochettes de boeuf marine", "brochettes de bœuf marine", "brochettes de boeuf mariné"], imageUrl: "/img/products/brochettes-boeuf-marine.jpg" },
  { keywords: ["boeuf marine", "bœuf mariné", "boeuf mariné", "bœuf marine"], imageUrl: "/img/products/boeuf-marine.jpg" },
  { keywords: ["plat de cotes", "plat de côtes"], imageUrl: "/img/products/plat-de-cotes.jpg" },
  { keywords: ["basse cote", "basse côte"],      imageUrl: "/img/products/basse-cote.jpg" },
  { keywords: ["cote de boeuf", "côte de boeuf", "cote de bœuf", "côte de bœuf"], imageUrl: "/img/products/cote-de-boeuf.jpg" },
  { keywords: ["faux filet", "faux-filet"],      imageUrl: "/img/products/faux-filet.jpg" },
  { keywords: ["hampe"],                         imageUrl: "/img/products/hampe.jpg" },
  { keywords: ["brochettes de boeuf", "brochettes de bœuf"], imageUrl: "/img/products/brochettes-boeuf.jpg" },
  { keywords: ["kefta", "boulettes"],            imageUrl: "/img/products/kefta-maison.jpg" },
  { keywords: ["rumsteak", "rumsteck"],          imageUrl: "/img/products/rumsteak.jpg" },
  { keywords: ["bourguignon"],                   imageUrl: "/img/products/rond-de-gite.jpg" },
  { keywords: ["blanquette de boeuf", "blanquette de bœuf"], imageUrl: "/img/products/roti-boeuf-extra.jpg" },

  // ── VEAU ──
  { keywords: ["roti de veau", "rôti de veau"],  imageUrl: "/img/products/roti-veau.jpg" },
  { keywords: ["poitrine de veau"],              imageUrl: "/img/products/poitrine-veau.jpg" },
  { keywords: ["jarret de veau"],                imageUrl: "/img/products/jarret-veau.jpg" },
  { keywords: ["paupiettes"],                    imageUrl: "/img/products/paupiettes-veau.jpg" },
  { keywords: ["cote de veau", "côte de veau", "cotes de veau", "côtes de veau"], imageUrl: "/img/products/cote-veau-lait.jpg" },
  { keywords: ["noix de veau"],                  imageUrl: "/img/products/noix-veau.jpg" },
  { keywords: ["escalope de veau"],              imageUrl: "/img/products/escalope-veau.jpg" },
  { keywords: ["blanquette de veau"],            imageUrl: "/img/products/poitrine-veau.jpg" },
  { keywords: ["carre de veau", "carré de veau"], imageUrl: "/img/products/carre-veau.jpg" },
  { keywords: ["tendrons"],                      imageUrl: "/img/products/tendrons-veau.jpg" },

  // ── VOLAILLE ──
  { keywords: ["poulet blanc", "poulet entier"], imageUrl: "/img/products/poulet-blanc.jpg" },
  { keywords: ["cuisses de poulet"],             imageUrl: "/img/products/cuisses-poulet.jpg" },
  { keywords: ["filet de poulet"],               imageUrl: "/img/products/filet-poulet.jpg" },
  { keywords: ["cuisses de dinde"],              imageUrl: "/img/products/cuisses-dinde.jpg" },
  { keywords: ["filet de dinde"],                imageUrl: "/img/products/filet-dinde.jpg" },
  { keywords: ["pilons"],                        imageUrl: "/img/products/pilons-poulet.jpg" },
  { keywords: ["poulet fermier"],                imageUrl: "/img/products/poulet-fermier.jpg" },
  { keywords: ["poulet marine", "poulet mariné"], imageUrl: "/img/products/poulet-marine.jpg" },
  { keywords: ["poulet roti", "poulet rôti"],    imageUrl: "/img/products/poulet-roti.jpg" },
  { keywords: ["ailes de poulet"],               imageUrl: "/img/products/ailes-poulet.jpg" },
  { keywords: ["brochettes de poulet", "brochette de poulet"], imageUrl: "/img/products/brochettes-poulet-marine.jpg" },
  { keywords: ["cordon bleu"],                   imageUrl: "/img/products/filet-poulet.jpg" },

  // ── AGNEAU ──
  { keywords: ["selle d'agneau", "selle d agneau", "selle agneau"], imageUrl: "/img/products/selle-agneau.jpg" },
  { keywords: ["carre d'agneau", "carré d'agneau", "carre d agneau", "carre agneau"], imageUrl: "/img/products/carre-agneau.jpg" },
  { keywords: ["cotes d'agneau", "côtes d'agneau", "cotes d agneau"], imageUrl: "/img/products/cotes-agneau-filet.jpg" },
  { keywords: ["gigot"],                         imageUrl: "/img/products/gigot-agneau.jpg" },
  { keywords: ["epaule d'agneau", "épaule d'agneau", "epaule d agneau", "epaule agneau"], imageUrl: "/img/products/epaule-agneau.jpg" },
  { keywords: ["collier"],                       imageUrl: "/img/products/collier-agneau.jpg" },
  { keywords: ["poitrine d'agneau", "poitrine d agneau", "poitrine agneau"], imageUrl: "/img/products/poitrine-agneau.jpg" },
  { keywords: ["brochettes d'agneau", "brochettes d agneau", "brochettes agneau"], imageUrl: "/img/products/brochettes-agneau.jpg" },
  { keywords: ["saucisses d'agneau", "saucisses agneau"], imageUrl: "/img/products/saucisses-agneau.jpg" },

  // ── SAUCISSES ──
  { keywords: ["chipolata"],                     imageUrl: "/img/products/chipolatas.jpg" },
  { keywords: ["merguez"],                       imageUrl: "/img/products/merguez.jpg" },
  { keywords: ["saucisse de volaille", "saucisses de volaille"], imageUrl: "/img/products/saucisse-volaille.jpg" },
  { keywords: ["saucisses tunisiennes", "saucisse tunisienne"], imageUrl: "/img/products/saucisses-tunisiennes.jpg" },

  // ── CHARCUTERIE ──
  { keywords: ["delice de dinde", "délice de dinde"], imageUrl: "/img/products/delice-dinde.jpg" },
  { keywords: ["delice de poulet", "délice de poulet"], imageUrl: "/img/products/delice-poulet.jpg" },
  { keywords: ["pastrami"],                      imageUrl: "/img/products/pastrami-boeuf.jpg" },
  { keywords: ["bacon"],                         imageUrl: "/img/products/bacon-dinde.jpg" },
  { keywords: ["rosette"],                       imageUrl: "/img/products/rosette.jpg" },
  { keywords: ["mortadelle"],                    imageUrl: "/img/products/mortadelle.jpg" },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/['']/g, " ")          // normalize apostrophes
    .trim();
}

function findImageForProduct(productName: string): string | null {
  const name = normalize(productName);

  for (const entry of IMAGE_MAP) {
    for (const keyword of entry.keywords) {
      if (name.includes(normalize(keyword))) {
        return entry.imageUrl;
      }
    }
  }

  return null; // no match → don't touch
}

async function main() {
  console.log("🖼️  Migration images produits — Klik&Go\n");
  console.log("Mode: UPDATE ONLY (aucune creation, aucune suppression)\n");

  // Get ALL products from ALL shops
  const products = await prisma.product.findMany({
    select: { id: true, name: true, imageUrl: true, shopId: true },
  });

  console.log(`📦 ${products.length} produits trouves en DB\n`);

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const product of products) {
    const newImageUrl = findImageForProduct(product.name);

    if (!newImageUrl) {
      // No match → skip, don't touch
      skipped++;
      continue;
    }

    if (product.imageUrl === newImageUrl) {
      // Already correct
      unchanged++;
      continue;
    }

    // Update imageUrl
    await prisma.product.update({
      where: { id: product.id },
      data: { imageUrl: newImageUrl },
    });

    console.log(`   ✅ ${product.name} → ${newImageUrl}`);
    updated++;
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ Mis a jour: ${updated}`);
  console.log(`⏭️  Pas de correspondance (non touche): ${skipped}`);
  console.log(`🔄 Deja correct: ${unchanged}`);
  console.log(`📦 Total: ${products.length}`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error("❌ Erreur:", e); await prisma.$disconnect(); process.exit(1); });
