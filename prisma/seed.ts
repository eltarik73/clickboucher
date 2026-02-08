// ═══════════════════════════════════════════════
// KLIK&GO — Seed Data (Chambéry, fictif réaliste)
// ═══════════════════════════════════════════════

import { PrismaClient, Role, ProStatus, OrderStatus, Unit } from "@prisma/client";

const prisma = new PrismaClient();

// ── Unsplash Placeholders ────────────────────

const IMG = {
  shops: {
    savoie: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
    perrin: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&q=80",
    etal: "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&q=80",
  },
  products: {
    entrecote: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80",
    coteDeBeuf: "https://images.unsplash.com/photo-1615937691194-97dbd3f3dc29?w=600&q=80",
    saucisses: "https://images.unsplash.com/photo-1623238912680-26fc5ffb57e4?w=600&q=80",
    poulet: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80",
    agneau: "https://images.unsplash.com/photo-1608039829572-4885a8b1e1d8?w=600&q=80",
    merguez: "https://images.unsplash.com/photo-1599921841143-819065a55cc6?w=600&q=80",
    roti: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
    filetMignon: "https://images.unsplash.com/photo-1588347818481-79e30b021056?w=600&q=80",
    veau: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80",
    paupiettes: "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=600&q=80",
    jambon: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&q=80",
  },
};

// ── Helpers ───────────────────────────────────

function minutesFromNow(m: number): Date {
  return new Date(Date.now() + m * 60_000);
}
function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60_000);
}

const defaultOpeningHours = {
  lundi: { open: "08:00", close: "19:00" },
  mardi: { open: "08:00", close: "19:00" },
  mercredi: { open: "08:00", close: "19:00" },
  jeudi: { open: "08:00", close: "19:00" },
  vendredi: { open: "08:00", close: "19:00" },
  samedi: { open: "07:30", close: "13:00" },
  dimanche: null,
};

async function main() {
  console.log("🌱 Seeding Klik&Go database...\n");

  // ── Clean ────────────────────────────────
  console.log("🗑  Cleaning existing data...");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  // ═══════════════════════════════════════════
  // 1. USERS
  // ═══════════════════════════════════════════

  console.log("👤 Creating users...");

  const boucher1 = await prisma.user.create({
    data: { clerkId: "clerk_boucher_001", email: "jp.duval@savoie-tradition.fr", phone: "+33600000001", firstName: "Jean-Pierre", lastName: "Duval", role: Role.BOUCHER },
  });
  const boucher2 = await prisma.user.create({
    data: { clerkId: "clerk_boucher_002", email: "m.perrin@maison-perrin.fr", phone: "+33600000002", firstName: "Michel", lastName: "Perrin", role: Role.BOUCHER },
  });
  const boucher3 = await prisma.user.create({
    data: { clerkId: "clerk_boucher_003", email: "c.montagne@etal-marche.fr", phone: "+33600000003", firstName: "Claire", lastName: "Montagne", role: Role.BOUCHER },
  });

  const particuliers = await Promise.all([
    prisma.user.create({ data: { clerkId: "clerk_client_001", email: "marie.dupont@email.fr", phone: "+33611000001", firstName: "Marie", lastName: "Dupont", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_002", email: "pierre.martin@email.fr", phone: "+33611000002", firstName: "Pierre", lastName: "Martin", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_003", email: "sophie.m@email.fr", phone: "+33611000003", firstName: "Sophie", lastName: "Moreau", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_004", email: "lucas.bernard@email.fr", phone: "+33611000004", firstName: "Lucas", lastName: "Bernard", role: Role.CLIENT } }),
    prisma.user.create({ data: { clerkId: "clerk_client_005", email: "emma.petit@email.fr", phone: "+33611000005", firstName: "Emma", lastName: "Petit", role: Role.CLIENT } }),
  ]);

  const pros = await Promise.all([
    prisma.user.create({ data: { clerkId: "clerk_pro_001", email: "bob@bobsburgers.fr", phone: "+33622000001", firstName: "Bob", lastName: "Burger", role: Role.CLIENT_PRO, proStatus: ProStatus.APPROVED, siret: "12345678900015", companyName: "Bob's Burgers SARL", sector: "Restauration" } }),
    prisma.user.create({ data: { clerkId: "clerk_pro_002", email: "contact@chalet-savoyard.fr", phone: "+33622000002", firstName: "Alain", lastName: "Ducasse", role: Role.CLIENT_PRO, proStatus: ProStatus.APPROVED, siret: "98765432100028", companyName: "Le Chalet Savoyard", sector: "Restauration" } }),
    prisma.user.create({ data: { clerkId: "clerk_pro_003", email: "eric@cantine-scolaire.fr", phone: "+33622000003", firstName: "Éric", lastName: "Cantine", role: Role.CLIENT_PRO_PENDING, proStatus: ProStatus.PENDING, siret: "78912345600056", companyName: "Cantine Scolaire Chambéry", sector: "Restauration collective" } }),
  ]);

  console.log(`   ✅ ${3 + particuliers.length + pros.length} users created`);

  // ═══════════════════════════════════════════
  // 2. SHOPS
  // ═══════════════════════════════════════════

  console.log("🏪 Creating shops...");

  const shop1 = await prisma.shop.create({
    data: {
      ownerId: boucher1.clerkId,
      name: "Boucherie Savoie Tradition",
      slug: "savoie-tradition",
      description: "Boucherie artisanale depuis 1987. Viande locale maturée, charcuterie maison.",
      address: "12 Rue de Boigne",
      city: "Chambéry",
      phone: "04 79 33 12 34",
      imageUrl: IMG.shops.savoie,
      openingHours: defaultOpeningHours,
      prepTimeMin: 15,
      isOpen: true,
      autoAccept: false,
      maxOrdersHour: 20,
      rating: 4.8,
      ratingCount: 124,
    },
  });

  const shop2 = await prisma.shop.create({
    data: {
      ownerId: boucher2.clerkId,
      name: "Maison Perrin",
      slug: "maison-perrin",
      description: "Charcuterie artisanale et boucherie fine. Spécialités savoyardes.",
      address: "45 Place Saint-Léger",
      city: "Chambéry",
      phone: "04 79 85 67 89",
      imageUrl: IMG.shops.perrin,
      openingHours: defaultOpeningHours,
      prepTimeMin: 20,
      isOpen: true,
      autoAccept: true,
      maxOrdersHour: 15,
      rating: 4.6,
      ratingCount: 89,
    },
  });

  const shop3 = await prisma.shop.create({
    data: {
      ownerId: boucher3.clerkId,
      name: "L'Étal du Marché",
      slug: "etal-du-marche",
      description: "Boucherie bio et locale. 100% viande française, circuit court.",
      address: "8 Avenue du Comte Vert",
      city: "Chambéry",
      phone: "04 79 62 45 78",
      imageUrl: IMG.shops.etal,
      openingHours: defaultOpeningHours,
      prepTimeMin: 10,
      isOpen: false,
      paused: true,
      maxOrdersHour: 25,
      rating: 4.9,
      ratingCount: 201,
    },
  });

  console.log("   ✅ 3 shops created");

  // ═══════════════════════════════════════════
  // 3. CATEGORIES
  // ═══════════════════════════════════════════

  console.log("📂 Creating categories...");

  const catBeuf1 = await prisma.category.create({ data: { name: "Bœuf", emoji: "🥩", order: 1, shopId: shop1.id } });
  const catPorc1 = await prisma.category.create({ data: { name: "Porc", emoji: "🐷", order: 2, shopId: shop1.id } });
  const catCharc1 = await prisma.category.create({ data: { name: "Charcuterie", emoji: "🌭", order: 3, shopId: shop1.id } });
  const catVol1 = await prisma.category.create({ data: { name: "Volaille", emoji: "🍗", order: 4, shopId: shop1.id } });
  const catVeau1 = await prisma.category.create({ data: { name: "Veau", emoji: "🥩", order: 5, shopId: shop1.id } });
  const catAgn1 = await prisma.category.create({ data: { name: "Agneau", emoji: "🐑", order: 6, shopId: shop1.id } });

  const catCharc2 = await prisma.category.create({ data: { name: "Charcuterie", emoji: "🌭", order: 1, shopId: shop2.id } });
  const catBeuf2 = await prisma.category.create({ data: { name: "Bœuf", emoji: "🥩", order: 2, shopId: shop2.id } });
  const catVeau2 = await prisma.category.create({ data: { name: "Veau", emoji: "🥩", order: 3, shopId: shop2.id } });

  const catBio3 = await prisma.category.create({ data: { name: "Bio", emoji: "🌿", order: 1, shopId: shop3.id } });

  console.log("   ✅ 10 categories created");

  // ═══════════════════════════════════════════
  // 4. PRODUCTS
  // ═══════════════════════════════════════════

  console.log("🥩 Creating products...");

  // Shop 1: Savoie Tradition
  const s1Products = await Promise.all([
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catBeuf1.id, name: "Entrecôte", description: "Maturée 21 jours, persillée et tendre", imageUrl: IMG.products.entrecote, unit: Unit.KG, priceCents: 3200, proPriceCents: 2600, tags: ["Populaire", "Maturé"] } }),
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catBeuf1.id, name: "Côte de bœuf", description: "Race Salers, maturée 30 jours", imageUrl: IMG.products.coteDeBeuf, unit: Unit.KG, priceCents: 3800, proPriceCents: 3100, tags: ["Maturé"] } }),
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catPorc1.id, name: "Filet mignon de porc", description: "Fermier, idéal en croûte ou rôti", imageUrl: IMG.products.filetMignon, unit: Unit.KG, priceCents: 1890, proPriceCents: 1550, tags: [] } }),
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catCharc1.id, name: "Merguez maison", description: "Barquette de 6, épices douces", imageUrl: IMG.products.merguez, unit: Unit.BARQUETTE, priceCents: 890, proPriceCents: 690, stockQty: 20, tags: ["Populaire"] } }),
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catCharc1.id, name: "Saucisses de Toulouse", description: "Pur porc, à griller ou poêler", imageUrl: IMG.products.saucisses, unit: Unit.BARQUETTE, priceCents: 790, proPriceCents: 620, stockQty: 15, tags: [] } }),
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catVol1.id, name: "Poulet fermier entier", description: "Label Rouge, élevé en plein air", imageUrl: IMG.products.poulet, unit: Unit.PIECE, priceCents: 1490, proPriceCents: 1200, stockQty: 8, tags: ["Label Rouge"] } }),
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catVeau1.id, name: "Rôti de veau", description: "Sous la mère, ficelé main", imageUrl: IMG.products.roti, unit: Unit.KG, priceCents: 2800, proPriceCents: 2300, tags: [] } }),
    prisma.product.create({ data: { shopId: shop1.id, categoryId: catAgn1.id, name: "Gigot d'agneau", description: "Agneau de lait des Alpes", imageUrl: IMG.products.agneau, unit: Unit.KG, priceCents: 2600, proPriceCents: 2100, inStock: false, tags: [] } }),
  ]);

  // Shop 2: Maison Perrin
  const s2Products = await Promise.all([
    prisma.product.create({ data: { shopId: shop2.id, categoryId: catCharc2.id, name: "Diots de Savoie", description: "Diots traditionnels au vin blanc", imageUrl: IMG.products.saucisses, unit: Unit.BARQUETTE, priceCents: 990, proPriceCents: 780, stockQty: 25, tags: ["Spécialité"] } }),
    prisma.product.create({ data: { shopId: shop2.id, categoryId: catBeuf2.id, name: "Entrecôte Black Angus", description: "Persillage exceptionnel", imageUrl: IMG.products.entrecote, unit: Unit.KG, priceCents: 4200, proPriceCents: 3500, tags: ["Premium"] } }),
    prisma.product.create({ data: { shopId: shop2.id, categoryId: catVeau2.id, name: "Paupiettes de veau", description: "Farcies maison, prêtes à cuire", imageUrl: IMG.products.paupiettes, unit: Unit.PIECE, priceCents: 590, proPriceCents: 470, stockQty: 12, tags: [] } }),
    prisma.product.create({ data: { shopId: shop2.id, categoryId: catCharc2.id, name: "Jambon sec de Savoie", description: "Affiné 12 mois", imageUrl: IMG.products.jambon, unit: Unit.KG, priceCents: 3600, proPriceCents: 2900, tags: ["Artisanal"] } }),
  ]);

  // Shop 3: L'Étal du Marché
  const s3Products = await Promise.all([
    prisma.product.create({ data: { shopId: shop3.id, categoryId: catBio3.id, name: "Entrecôte bio", description: "Bœuf bio, élevage plein air certifié AB", imageUrl: IMG.products.entrecote, unit: Unit.KG, priceCents: 3900, proPriceCents: 3200, tags: ["Bio", "AB"] } }),
    prisma.product.create({ data: { shopId: shop3.id, categoryId: catBio3.id, name: "Poulet bio fermier", description: "81 jours d'élevage minimum", imageUrl: IMG.products.poulet, unit: Unit.PIECE, priceCents: 1890, proPriceCents: 1550, stockQty: 6, tags: ["Bio"] } }),
    prisma.product.create({ data: { shopId: shop3.id, categoryId: catBio3.id, name: "Merguez bio", description: "100% bœuf bio, sans additifs", imageUrl: IMG.products.merguez, unit: Unit.BARQUETTE, priceCents: 1090, proPriceCents: 890, stockQty: 10, tags: ["Bio"] } }),
  ]);

  const allProducts = [...s1Products, ...s2Products, ...s3Products];
  console.log(`   ✅ ${allProducts.length} products created`);

  // ═══════════════════════════════════════════
  // 5. ORDERS
  // ═══════════════════════════════════════════

  console.log("📋 Creating demo orders...");

  // Order 1: READY (Marie)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00001",
      shopId: shop1.id,
      userId: particuliers[0].id,
      status: OrderStatus.READY,
      requestedTime: "asap",
      totalCents: 4580,
      estimatedReady: minutesAgo(5),
      actualReady: minutesAgo(5),
      qrCode: "KG-QR-00001",
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Products[0].id, name: "Entrecôte", quantity: 1, unit: Unit.KG, priceCents: 3200, totalCents: 3200 } }),
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Products[3].id, name: "Merguez maison", quantity: 1, unit: Unit.BARQUETTE, priceCents: 890, totalCents: 890 } }),
  ]);

  // Order 2: PREPARING (Bob Burger, PRO)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00002",
      shopId: shop1.id,
      userId: pros[0].id,
      isPro: true,
      status: OrderStatus.PREPARING,
      requestedTime: "asap",
      totalCents: 17850,
      estimatedReady: minutesFromNow(15),
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order2.id, productId: s1Products[1].id, name: "Côte de bœuf", quantity: 5, unit: Unit.KG, priceCents: 3100, totalCents: 15500 } }),
    prisma.orderItem.create({ data: { orderId: order2.id, productId: s1Products[6].id, name: "Rôti de veau", quantity: 1, unit: Unit.KG, priceCents: 2300, totalCents: 2300 } }),
  ]);

  // Order 3: COMPLETED (Le Chalet Savoyard, PRO — avec rating)
  const order3 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00003",
      shopId: shop1.id,
      userId: pros[1].id,
      isPro: true,
      status: OrderStatus.COMPLETED,
      totalCents: 6720,
      actualReady: minutesAgo(1470),
      pickedUpAt: minutesAgo(1440),
      qrCode: "KG-QR-00003",
      qrScannedAt: minutesAgo(1440),
      rating: 5,
      ratingComment: "Excellent comme toujours !",
    },
  });
  await prisma.orderItem.create({ data: { orderId: order3.id, productId: s1Products[0].id, name: "Entrecôte", quantity: 2, unit: Unit.KG, priceCents: 2600, totalCents: 5200 } });

  // Order 4: DENIED (Sophie — boucher a refusé)
  await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00004",
      shopId: shop2.id,
      userId: particuliers[2].id,
      status: OrderStatus.DENIED,
      totalCents: 2370,
      denyReason: "Rupture de stock sur les paupiettes",
    },
  });

  // Order 5: CANCELLED (Lucas)
  await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00005",
      shopId: shop2.id,
      userId: particuliers[3].id,
      status: OrderStatus.CANCELLED,
      totalCents: 1580,
      customerNote: "Finalement je ne peux pas venir",
    },
  });

  // Order 6: PENDING (Emma)
  const order6 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00006",
      shopId: shop1.id,
      userId: particuliers[4].id,
      status: OrderStatus.PENDING,
      requestedTime: "asap",
      totalCents: 1490,
    },
  });
  await prisma.orderItem.create({ data: { orderId: order6.id, productId: s1Products[5].id, name: "Poulet fermier entier", quantity: 1, unit: Unit.PIECE, priceCents: 1490, totalCents: 1490 } });

  // Order 7: PARTIALLY_DENIED (Pierre — 1 article indisponible)
  const order7 = await prisma.order.create({
    data: {
      orderNumber: "KG-2026-00007",
      shopId: shop2.id,
      userId: particuliers[1].id,
      status: OrderStatus.PARTIALLY_DENIED,
      totalCents: 4790,
      boucherNote: "Paupiettes indisponibles, remplacées par escalopes",
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order7.id, productId: s2Products[1].id, name: "Entrecôte Black Angus", quantity: 1, unit: Unit.KG, priceCents: 4200, totalCents: 4200 } }),
    prisma.orderItem.create({ data: { orderId: order7.id, productId: s2Products[2].id, name: "Paupiettes de veau", quantity: 1, unit: Unit.PIECE, priceCents: 590, totalCents: 590, available: false, replacement: "Escalopes de veau" } }),
  ]);

  console.log("   ✅ 7 orders created");

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════

  console.log("\n═══════════════════════════════════════════");
  console.log("🌱 SEED COMPLETE!");
  console.log("═══════════════════════════════════════════");
  console.log(`   👤 Users:      ${3 + particuliers.length + pros.length}`);
  console.log(`   🏪 Shops:      3`);
  console.log(`   📂 Categories: 10`);
  console.log(`   🥩 Products:   ${allProducts.length}`);
  console.log(`   📋 Orders:     7`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
