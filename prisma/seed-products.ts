// ═══════════════════════════════════════════════
// KLIK&GO — Seed produits reels avec images locales
// Upsert: ne supprime rien, ajoute ou met a jour
// Usage: npx tsx prisma/seed-products.ts
// ═══════════════════════════════════════════════

import { PrismaClient, Unit } from "@prisma/client";

const prisma = new PrismaClient();

// ── Categories a creer si absentes ──
const CATEGORIES = [
  { name: "Boeuf", emoji: "🥩", order: 1 },
  { name: "Veau", emoji: "🫕", order: 2 },
  { name: "Volaille", emoji: "🐔", order: 3 },
  { name: "Agneau", emoji: "🐑", order: 4 },
  { name: "Saucisses", emoji: "🌭", order: 5 },
  { name: "Charcuterie", emoji: "🥓", order: 6 },
];

// ── Produits avec images locales telechargees ──
interface ProductDef {
  category: string;
  name: string;
  priceCents: number;
  unit: "KG" | "PIECE";
  imageUrl: string;
}

const PRODUCTS: ProductDef[] = [
  // ── BOEUF ──
  { category: "Boeuf", name: "Bavette d'Aloyau", priceCents: 1850, unit: "KG", imageUrl: "/img/products/bavette-aloyau.jpg" },
  { category: "Boeuf", name: "Entrecote", priceCents: 2099, unit: "KG", imageUrl: "/img/products/entrecote-boeuf.jpg" },
  { category: "Boeuf", name: "Onglet de Boeuf", priceCents: 1899, unit: "KG", imageUrl: "/img/products/onglet-boeuf.jpg" },
  { category: "Boeuf", name: "Roti de Boeuf Extra", priceCents: 1899, unit: "KG", imageUrl: "/img/products/roti-boeuf-extra.jpg" },
  { category: "Boeuf", name: "Tournedos de Boeuf", priceCents: 2799, unit: "KG", imageUrl: "/img/products/tournedos-boeuf.jpg" },
  { category: "Boeuf", name: "Rond de gite", priceCents: 1799, unit: "KG", imageUrl: "/img/products/rond-de-gite.jpg" },
  { category: "Boeuf", name: "Viande hachee", priceCents: 1499, unit: "KG", imageUrl: "/img/products/viande-hachee.jpg" },
  { category: "Boeuf", name: "Steak hache", priceCents: 1499, unit: "KG", imageUrl: "/img/products/steak-hache.jpg" },
  { category: "Boeuf", name: "Boeuf marine", priceCents: 1899, unit: "KG", imageUrl: "/img/products/boeuf-marine.jpg" },
  { category: "Boeuf", name: "Brochettes de Boeuf marine", priceCents: 1899, unit: "KG", imageUrl: "/img/products/brochettes-boeuf-marine.jpg" },
  { category: "Boeuf", name: "Plat de cotes", priceCents: 1199, unit: "KG", imageUrl: "/img/products/plat-de-cotes.jpg" },
  { category: "Boeuf", name: "Basse cote (avec os)", priceCents: 1399, unit: "KG", imageUrl: "/img/products/basse-cote.jpg" },
  { category: "Boeuf", name: "Cote de boeuf", priceCents: 1799, unit: "KG", imageUrl: "/img/products/cote-de-boeuf.jpg" },
  { category: "Boeuf", name: "Faux filet", priceCents: 1590, unit: "KG", imageUrl: "/img/products/faux-filet.jpg" },
  { category: "Boeuf", name: "Hampe", priceCents: 1990, unit: "KG", imageUrl: "/img/products/hampe.jpg" },
  { category: "Boeuf", name: "Brochettes de boeuf", priceCents: 1799, unit: "KG", imageUrl: "/img/products/brochettes-boeuf.jpg" },
  { category: "Boeuf", name: "Kefta maison", priceCents: 1399, unit: "KG", imageUrl: "/img/products/kefta-maison.jpg" },
  { category: "Boeuf", name: "Rumsteak", priceCents: 1699, unit: "KG", imageUrl: "/img/products/rumsteak.jpg" },

  // ── VEAU ──
  { category: "Veau", name: "Roti de veau", priceCents: 1899, unit: "KG", imageUrl: "/img/products/roti-veau.jpg" },
  { category: "Veau", name: "Poitrine de veau", priceCents: 1199, unit: "KG", imageUrl: "/img/products/poitrine-veau.jpg" },
  { category: "Veau", name: "Jarret de veau", priceCents: 1299, unit: "KG", imageUrl: "/img/products/jarret-veau.jpg" },
  { category: "Veau", name: "Paupiettes de veau", priceCents: 1899, unit: "KG", imageUrl: "/img/products/paupiettes-veau.jpg" },
  { category: "Veau", name: "Cote de veau de lait", priceCents: 1799, unit: "KG", imageUrl: "/img/products/cote-veau-lait.jpg" },
  { category: "Veau", name: "Noix de veau", priceCents: 1899, unit: "KG", imageUrl: "/img/products/noix-veau.jpg" },
  { category: "Veau", name: "Escalope de veau", priceCents: 1999, unit: "KG", imageUrl: "/img/products/escalope-veau.jpg" },
  { category: "Veau", name: "Cotes de veau", priceCents: 1799, unit: "KG", imageUrl: "/img/products/cotes-veau.jpg" },
  { category: "Veau", name: "Carre de veau", priceCents: 1899, unit: "KG", imageUrl: "/img/products/carre-veau.jpg" },
  { category: "Veau", name: "Tendrons de veau", priceCents: 1399, unit: "KG", imageUrl: "/img/products/tendrons-veau.jpg" },

  // ── VOLAILLE ──
  { category: "Volaille", name: "Poulet Blanc", priceCents: 699, unit: "PIECE", imageUrl: "/img/products/poulet-blanc.jpg" },
  { category: "Volaille", name: "Cuisses de poulet", priceCents: 599, unit: "KG", imageUrl: "/img/products/cuisses-poulet.jpg" },
  { category: "Volaille", name: "Filet de poulet", priceCents: 1150, unit: "KG", imageUrl: "/img/products/filet-poulet.jpg" },
  { category: "Volaille", name: "Cuisses de dinde", priceCents: 1300, unit: "PIECE", imageUrl: "/img/products/cuisses-dinde.jpg" },
  { category: "Volaille", name: "Filet de dinde", priceCents: 1299, unit: "KG", imageUrl: "/img/products/filet-dinde.jpg" },
  { category: "Volaille", name: "Pilons de poulet", priceCents: 699, unit: "KG", imageUrl: "/img/products/pilons-poulet.jpg" },
  { category: "Volaille", name: "Poulet fermier", priceCents: 1500, unit: "PIECE", imageUrl: "/img/products/poulet-fermier.jpg" },
  { category: "Volaille", name: "Poulet marine", priceCents: 1199, unit: "KG", imageUrl: "/img/products/poulet-marine.jpg" },
  { category: "Volaille", name: "Poulet Roti", priceCents: 1000, unit: "KG", imageUrl: "/img/products/poulet-roti.jpg" },
  { category: "Volaille", name: "Ailes de poulet", priceCents: 650, unit: "KG", imageUrl: "/img/products/ailes-poulet.jpg" },
  { category: "Volaille", name: "Brochette de poulet marine", priceCents: 1299, unit: "KG", imageUrl: "/img/products/brochettes-poulet-marine.jpg" },

  // ── AGNEAU ──
  { category: "Agneau", name: "Selle d'Agneau", priceCents: 1799, unit: "KG", imageUrl: "/img/products/selle-agneau.jpg" },
  { category: "Agneau", name: "Carre d'Agneau", priceCents: 1799, unit: "KG", imageUrl: "/img/products/carre-agneau.jpg" },
  { category: "Agneau", name: "Cotes d'agneau en filet", priceCents: 1799, unit: "KG", imageUrl: "/img/products/cotes-agneau-filet.jpg" },
  { category: "Agneau", name: "Gigot d'agneau", priceCents: 1799, unit: "KG", imageUrl: "/img/products/gigot-agneau.jpg" },
  { category: "Agneau", name: "Epaule d'agneau", priceCents: 1599, unit: "KG", imageUrl: "/img/products/epaule-agneau.jpg" },
  { category: "Agneau", name: "Collier", priceCents: 1499, unit: "KG", imageUrl: "/img/products/collier-agneau.jpg" },
  { category: "Agneau", name: "Poitrine d'agneau", priceCents: 1199, unit: "KG", imageUrl: "/img/products/poitrine-agneau.jpg" },
  { category: "Agneau", name: "Brochettes d'agneau", priceCents: 1999, unit: "KG", imageUrl: "/img/products/brochettes-agneau.jpg" },

  // ── SAUCISSES ──
  { category: "Saucisses", name: "Chipolatas", priceCents: 1350, unit: "KG", imageUrl: "/img/products/chipolatas.jpg" },
  { category: "Saucisses", name: "Merguez", priceCents: 1350, unit: "KG", imageUrl: "/img/products/merguez.jpg" },
  { category: "Saucisses", name: "Saucisse de volaille", priceCents: 1299, unit: "KG", imageUrl: "/img/products/saucisse-volaille.jpg" },
  { category: "Saucisses", name: "Saucisses tunisiennes", priceCents: 1299, unit: "KG", imageUrl: "/img/products/saucisses-tunisiennes.jpg" },

  // ── CHARCUTERIE ──
  { category: "Charcuterie", name: "Delice de dinde", priceCents: 1899, unit: "KG", imageUrl: "/img/products/delice-dinde.jpg" },
  { category: "Charcuterie", name: "Delice de poulet", priceCents: 1899, unit: "KG", imageUrl: "/img/products/delice-poulet.jpg" },
  { category: "Charcuterie", name: "Pastrami de boeuf", priceCents: 1899, unit: "KG", imageUrl: "/img/products/pastrami-boeuf.jpg" },
  { category: "Charcuterie", name: "Bacon de Dinde", priceCents: 1899, unit: "KG", imageUrl: "/img/products/bacon-dinde.jpg" },
  { category: "Charcuterie", name: "Rosette", priceCents: 1899, unit: "KG", imageUrl: "/img/products/rosette.jpg" },
  { category: "Charcuterie", name: "Mortadelle", priceCents: 1899, unit: "KG", imageUrl: "/img/products/mortadelle.jpg" },
];

async function main() {
  console.log("🥩 Seed produits reels — Klik&Go\n");

  // ── Find first shop ──
  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
  if (!shop) {
    console.error("❌ Aucune boutique trouvee en DB. Lancez d'abord le seed principal.");
    process.exit(1);
  }
  console.log(`🏪 Boutique: ${shop.name} (${shop.id})\n`);

  // ── Upsert categories ──
  const catMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    // Check if category exists for this shop (match by name)
    let existing = await prisma.category.findFirst({
      where: { shopId: shop.id, name: cat.name },
    });

    if (!existing) {
      // Also check with accented variant (Bœuf vs Boeuf)
      const accentedNames: Record<string, string> = {
        "Boeuf": "Bœuf",
      };
      if (accentedNames[cat.name]) {
        existing = await prisma.category.findFirst({
          where: { shopId: shop.id, name: accentedNames[cat.name] },
        });
      }
    }

    if (existing) {
      catMap.set(cat.name, existing.id);
      console.log(`   📂 ${cat.name} — existante (${existing.id})`);
    } else {
      const created = await prisma.category.create({
        data: { name: cat.name, emoji: cat.emoji, order: cat.order, shopId: shop.id },
      });
      catMap.set(cat.name, created.id);
      console.log(`   📂 ${cat.name} — creee ✅`);
    }
  }

  // ── Upsert products ──
  let created = 0;
  let updated = 0;

  for (const p of PRODUCTS) {
    const categoryId = catMap.get(p.category);
    if (!categoryId) {
      console.warn(`   ⚠️  Categorie introuvable: ${p.category}`);
      continue;
    }

    // Check if product exists by name + shopId
    const existing = await prisma.product.findFirst({
      where: { shopId: shop.id, name: p.name },
    });

    if (existing) {
      // Update image + price
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          imageUrl: p.imageUrl,
          priceCents: p.priceCents,
          unit: Unit[p.unit],
          categories: { set: [{ id: categoryId }] },
          inStock: true,
          tags: ["halal"],
        },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: {
          shopId: shop.id,
          categories: { connect: [{ id: categoryId }] },
          name: p.name,
          imageUrl: p.imageUrl,
          priceCents: p.priceCents,
          unit: Unit[p.unit],
          inStock: true,
          tags: ["halal"],
        },
      });
      created++;
    }
  }

  console.log(`\n✅ Termine: ${created} crees, ${updated} mis a jour`);
  console.log(`📊 Total produits boutique: ${await prisma.product.count({ where: { shopId: shop.id } })}`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error("❌ Erreur:", e); await prisma.$disconnect(); process.exit(1); });
