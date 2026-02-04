// ═══════════════════════════════════════════════
// CLICKBOUCHER — Seed Data (Chambéry, fictif réaliste)
// ═══════════════════════════════════════════════

import { PrismaClient, UserRole, ProStatus, OrderStatus, PaymentStatus, PaymentMethod, ProductUnit, NotificationChannel } from "@prisma/client";

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
    bbq: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
    filetMignon: "https://images.unsplash.com/photo-1588347818481-79e30b021056?w=600&q=80",
    veau: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80",
    paupiettes: "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=600&q=80",
    jambon: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&q=80",
  },
  packs: {
    bbq: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&q=80",
    famille: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80",
    raclette: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
  },
  offers: {
    dm1: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80",
    dm2: "https://images.unsplash.com/photo-1599921841143-819065a55cc6?w=600&q=80",
    dm3: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
  },
};

// ── Helper ───────────────────────────────────

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3600_000);
}
function minutesFromNow(m: number): Date {
  return new Date(Date.now() + m * 60_000);
}
function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60_000);
}

async function main() {
  console.log("🌱 Seeding ClickBoucher database...\n");

  // ── Clean ────────────────────────────────
  console.log("🗑  Cleaning existing data...");
  await prisma.notification.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.proAccount.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.packItem.deleteMany();
  await prisma.pack.deleteMany();
  await prisma.product.deleteMany();
  await prisma.openingHours.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  // ═══════════════════════════════════════════
  // 1. USERS (20 = 3 bouchers + 12 particuliers + 5 pros)
  // ═══════════════════════════════════════════

  console.log("👤 Creating users...");

  // Bouchers (owners)
  const boucher1 = await prisma.user.create({
    data: {
      phone: "+33600000001",
      firstName: "Jean-Pierre",
      lastName: "Duval",
      email: "jp.duval@savoie-tradition.fr",
      role: UserRole.BOUCHER,
    },
  });
  const boucher2 = await prisma.user.create({
    data: {
      phone: "+33600000002",
      firstName: "Michel",
      lastName: "Perrin",
      email: "m.perrin@maison-perrin.fr",
      role: UserRole.BOUCHER,
    },
  });
  const boucher3 = await prisma.user.create({
    data: {
      phone: "+33600000003",
      firstName: "Claire",
      lastName: "Montagne",
      email: "c.montagne@etal-marche.fr",
      role: UserRole.BOUCHER,
    },
  });

  // Particuliers (12)
  const particuliers = await Promise.all([
    prisma.user.create({ data: { phone: "+33611000001", firstName: "Marie", lastName: "Dupont", email: "marie.dupont@email.fr", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000002", firstName: "Pierre", lastName: "Martin", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000003", firstName: "Sophie", lastName: "Moreau", email: "sophie.m@email.fr", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000004", firstName: "Lucas", lastName: "Bernard", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000005", firstName: "Emma", lastName: "Petit", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000006", firstName: "Thomas", lastName: "Roux", email: "t.roux@email.fr", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000007", firstName: "Léa", lastName: "Fournier", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000008", firstName: "Hugo", lastName: "Girard", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000009", firstName: "Chloé", lastName: "Bonnet", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000010", firstName: "Antoine", lastName: "Lambert", email: "a.lambert@email.fr", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000011", firstName: "Julie", lastName: "Mercier", role: UserRole.CLIENT } }),
    prisma.user.create({ data: { phone: "+33611000012", firstName: "Maxime", lastName: "Leroy", role: UserRole.CLIENT } }),
  ]);

  // PRO clients (5, dont Bob Burger)
  const pros = await Promise.all([
    prisma.user.create({ data: { phone: "+33622000001", firstName: "Bob", lastName: "Burger", email: "bob@bobsburgers.fr", role: UserRole.PRO, proStatus: ProStatus.APPROVED, siret: "12345678900015", companyName: "Bob's Burgers SARL" } }),
    prisma.user.create({ data: { phone: "+33622000002", firstName: "Alain", lastName: "Ducasse", email: "contact@chalet-savoyard.fr", role: UserRole.PRO, proStatus: ProStatus.APPROVED, siret: "98765432100028", companyName: "Le Chalet Savoyard" } }),
    prisma.user.create({ data: { phone: "+33622000003", firstName: "Nadia", lastName: "Traiteur", email: "nadia@traiteur-alpin.fr", role: UserRole.PRO, proStatus: ProStatus.APPROVED, siret: "45678912300042", companyName: "Traiteur Alpin" } }),
    prisma.user.create({ data: { phone: "+33622000004", firstName: "Éric", lastName: "Cantine", email: "eric@cantine-scolaire.fr", role: UserRole.PRO, proStatus: ProStatus.PENDING, siret: "78912345600056", companyName: "Cantine Scolaire Chambéry" } }),
    prisma.user.create({ data: { phone: "+33622000005", firstName: "Laura", lastName: "Pizzeria", email: "laura@pizza-savoie.fr", role: UserRole.PRO, proStatus: ProStatus.REJECTED, siret: "11122233300069", companyName: "Pizza Savoie" } }),
  ]);

  console.log(`   ✅ ${3 + particuliers.length + pros.length} users created`);

  // ═══════════════════════════════════════════
  // 2. SHOPS (3 boucheries Chambéry)
  // ═══════════════════════════════════════════

  console.log("🏪 Creating shops...");

  const shop1 = await prisma.shop.create({
    data: {
      ownerId: boucher1.id,
      name: "Boucherie Savoie Tradition",
      slug: "savoie-tradition",
      description: "Boucherie artisanale depuis 1987. Viande locale maturée, charcuterie maison. Spécialiste des grillades et de la maturation longue durée.",
      address: "12 Rue de Boigne",
      city: "Chambéry",
      postalCode: "73000",
      phone: "04 79 33 12 34",
      imageUrl: IMG.shops.savoie,
      coverUrl: IMG.shops.savoie,
      latitude: 45.5646,
      longitude: 5.9178,
      isServiceActive: true,
      prepTimeMinutes: 15,
      maxOrdersPer15: 5,
      allowCashPayment: true,
      allowShopCardPayment: true,
      rating: 4.8,
      reviewCount: 124,
    },
  });

  const shop2 = await prisma.shop.create({
    data: {
      ownerId: boucher2.id,
      name: "Maison Perrin",
      slug: "maison-perrin",
      description: "Charcuterie artisanale et boucherie fine. Spécialités savoyardes : diots, pormoniers, longeole. Viandes sélectionnées auprès d'éleveurs locaux.",
      address: "45 Place Saint-Léger",
      city: "Chambéry",
      postalCode: "73000",
      phone: "04 79 85 67 89",
      imageUrl: IMG.shops.perrin,
      coverUrl: IMG.shops.perrin,
      latitude: 45.5662,
      longitude: 5.9211,
      isServiceActive: true,
      prepTimeMinutes: 20,
      maxOrdersPer15: 4,
      allowCashPayment: true,
      allowShopCardPayment: true,
      rating: 4.6,
      reviewCount: 89,
    },
  });

  const shop3 = await prisma.shop.create({
    data: {
      ownerId: boucher3.id,
      name: "L'Étal du Marché",
      slug: "etal-du-marche",
      description: "Boucherie bio et locale. 100% viande française, circuit court. Engagement bien-être animal et traçabilité complète.",
      address: "8 Avenue du Comte Vert",
      city: "Chambéry",
      postalCode: "73000",
      phone: "04 79 62 45 78",
      imageUrl: IMG.shops.etal,
      coverUrl: IMG.shops.etal,
      latitude: 45.5630,
      longitude: 5.9195,
      isServiceActive: false, // fermé pour démo
      prepTimeMinutes: 10,
      maxOrdersPer15: 6,
      allowCashPayment: false,
      allowShopCardPayment: true,
      rating: 4.9,
      reviewCount: 201,
    },
  });

  console.log("   ✅ 3 shops created");

  // ── Opening Hours (Lun-Sam, fermé dimanche) ─

  console.log("🕐 Creating opening hours...");

  const defaultHours = [
    { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isClosed: true },  // Dimanche
    { dayOfWeek: 1, openTime: "08:00", closeTime: "19:00", isClosed: false }, // Lundi
    { dayOfWeek: 2, openTime: "08:00", closeTime: "19:00", isClosed: false },
    { dayOfWeek: 3, openTime: "08:00", closeTime: "19:00", isClosed: false },
    { dayOfWeek: 4, openTime: "08:00", closeTime: "19:00", isClosed: false },
    { dayOfWeek: 5, openTime: "08:00", closeTime: "19:00", isClosed: false },
    { dayOfWeek: 6, openTime: "07:30", closeTime: "13:00", isClosed: false }, // Samedi matin
  ];

  for (const shop of [shop1, shop2, shop3]) {
    for (const h of defaultHours) {
      await prisma.openingHours.create({
        data: { shopId: shop.id, ...h },
      });
    }
  }
  console.log("   ✅ 21 opening hours created");

  // ═══════════════════════════════════════════
  // 3. PRODUCTS (per shop)
  // ═══════════════════════════════════════════

  console.log("🥩 Creating products...");

  // Shop 1: Savoie Tradition
  const s1Products = await Promise.all([
    prisma.product.create({ data: { shopId: shop1.id, name: "Entrecôte", description: "Entrecôte de bœuf maturée 21 jours, persillée et tendre", imageUrl: IMG.products.entrecote, category: "Bœuf", unit: ProductUnit.KG, priceCents: 3200, proPriceCents: 2600, weightStep: 100, minWeight: 200, sortOrder: 1 } }),
    prisma.product.create({ data: { shopId: shop1.id, name: "Côte de bœuf", description: "Côte de bœuf de race Salers, maturée 30 jours minimum", imageUrl: IMG.products.coteDeBeuf, category: "Bœuf", unit: ProductUnit.KG, priceCents: 3800, proPriceCents: 3100, weightStep: 100, minWeight: 600, sortOrder: 2 } }),
    prisma.product.create({ data: { shopId: shop1.id, name: "Filet mignon de porc", description: "Filet mignon fermier, idéal en croûte ou rôti", imageUrl: IMG.products.filetMignon, category: "Porc", unit: ProductUnit.KG, priceCents: 1890, proPriceCents: 1550, weightStep: 100, minWeight: 300, sortOrder: 3 } }),
    prisma.product.create({ data: { shopId: shop1.id, name: "Merguez maison", description: "Merguez artisanales, recette maison aux épices douces", imageUrl: IMG.products.merguez, category: "Charcuterie", unit: ProductUnit.BARQUETTE, priceCents: 890, proPriceCents: 690, stockQty: 20, sortOrder: 4 } }),
    prisma.product.create({ data: { shopId: shop1.id, name: "Saucisses de Toulouse", description: "Saucisses fraîches pur porc, à griller ou poêler", imageUrl: IMG.products.saucisses, category: "Charcuterie", unit: ProductUnit.BARQUETTE, priceCents: 790, proPriceCents: 620, stockQty: 15, sortOrder: 5 } }),
    prisma.product.create({ data: { shopId: shop1.id, name: "Poulet fermier entier", description: "Poulet fermier Label Rouge, élevé en plein air en Savoie", imageUrl: IMG.products.poulet, category: "Volaille", unit: ProductUnit.PIECE, priceCents: 1490, proPriceCents: 1200, stockQty: 8, sortOrder: 6 } }),
    prisma.product.create({ data: { shopId: shop1.id, name: "Rôti de veau", description: "Rôti de veau sous la mère, ficelé main", imageUrl: IMG.products.roti, category: "Veau", unit: ProductUnit.KG, priceCents: 2800, proPriceCents: 2300, weightStep: 100, minWeight: 500, sortOrder: 7 } }),
    prisma.product.create({ data: { shopId: shop1.id, name: "Gigot d'agneau", description: "Gigot d'agneau de lait des Alpes, tendre et parfumé", imageUrl: IMG.products.agneau, category: "Agneau", unit: ProductUnit.KG, priceCents: 2600, proPriceCents: 2100, weightStep: 100, minWeight: 1000, sortOrder: 8 } }),
  ]);

  // Shop 2: Maison Perrin
  const s2Products = await Promise.all([
    prisma.product.create({ data: { shopId: shop2.id, name: "Diots de Savoie", description: "Diots traditionnels au vin blanc, recette familiale", imageUrl: IMG.products.saucisses, category: "Charcuterie", unit: ProductUnit.BARQUETTE, priceCents: 990, proPriceCents: 780, stockQty: 25, sortOrder: 1 } }),
    prisma.product.create({ data: { shopId: shop2.id, name: "Entrecôte Black Angus", description: "Entrecôte Black Angus importée, persillage exceptionnel", imageUrl: IMG.products.entrecote, category: "Bœuf", unit: ProductUnit.KG, priceCents: 4200, proPriceCents: 3500, weightStep: 100, minWeight: 250, sortOrder: 2 } }),
    prisma.product.create({ data: { shopId: shop2.id, name: "Paupiettes de veau", description: "Paupiettes farcies maison, prêtes à cuire", imageUrl: IMG.products.paupiettes, category: "Veau", unit: ProductUnit.PIECE, priceCents: 590, proPriceCents: 470, stockQty: 12, sortOrder: 3 } }),
    prisma.product.create({ data: { shopId: shop2.id, name: "Jambon sec de Savoie", description: "Jambon sec artisanal affiné 12 mois", imageUrl: IMG.products.jambon, category: "Charcuterie", unit: ProductUnit.KG, priceCents: 3600, proPriceCents: 2900, weightStep: 50, minWeight: 100, sortOrder: 4 } }),
    prisma.product.create({ data: { shopId: shop2.id, name: "Côte de veau", description: "Côte de veau épaisse, élevage local", imageUrl: IMG.products.veau, category: "Veau", unit: ProductUnit.KG, priceCents: 3200, proPriceCents: 2650, weightStep: 100, minWeight: 250, sortOrder: 5 } }),
  ]);

  // Shop 3: L'Étal du Marché
  const s3Products = await Promise.all([
    prisma.product.create({ data: { shopId: shop3.id, name: "Entrecôte bio", description: "Entrecôte de bœuf bio, élevage plein air certifié AB", imageUrl: IMG.products.entrecote, category: "Bœuf Bio", unit: ProductUnit.KG, priceCents: 3900, proPriceCents: 3200, weightStep: 100, minWeight: 200, sortOrder: 1 } }),
    prisma.product.create({ data: { shopId: shop3.id, name: "Poulet bio fermier", description: "Poulet bio certifié, 81 jours d'élevage minimum", imageUrl: IMG.products.poulet, category: "Volaille Bio", unit: ProductUnit.PIECE, priceCents: 1890, proPriceCents: 1550, stockQty: 6, sortOrder: 2 } }),
    prisma.product.create({ data: { shopId: shop3.id, name: "Agneau bio des Alpes", description: "Épaule d'agneau bio, pâturages alpins", imageUrl: IMG.products.agneau, category: "Agneau Bio", unit: ProductUnit.KG, priceCents: 3200, proPriceCents: 2650, weightStep: 100, minWeight: 500, sortOrder: 3 } }),
    prisma.product.create({ data: { shopId: shop3.id, name: "Merguez bio", description: "Merguez 100% bœuf bio, sans additifs", imageUrl: IMG.products.merguez, category: "Charcuterie Bio", unit: ProductUnit.BARQUETTE, priceCents: 1090, proPriceCents: 890, stockQty: 10, sortOrder: 4 } }),
  ]);

  const allProducts = [...s1Products, ...s2Products, ...s3Products];
  console.log(`   ✅ ${allProducts.length} products created`);

  // ═══════════════════════════════════════════
  // 4. PACKS
  // ═══════════════════════════════════════════

  console.log("📦 Creating packs...");

  const pack1 = await prisma.pack.create({
    data: {
      shopId: shop1.id,
      name: "Pack BBQ Savoyard",
      description: "Tout pour un BBQ réussi : entrecôtes, merguez et saucisses",
      imageUrl: IMG.packs.bbq,
      priceCents: 3890,
      proPriceCents: 3200,
      stockQty: 10,
      sortOrder: 1,
    },
  });
  await Promise.all([
    prisma.packItem.create({ data: { packId: pack1.id, productId: s1Products[0].id, quantity: 2, unit: ProductUnit.KG, weightGrams: 500 } }),
    prisma.packItem.create({ data: { packId: pack1.id, productId: s1Products[3].id, quantity: 1, unit: ProductUnit.BARQUETTE } }),
    prisma.packItem.create({ data: { packId: pack1.id, productId: s1Products[4].id, quantity: 1, unit: ProductUnit.BARQUETTE } }),
  ]);

  const pack2 = await prisma.pack.create({
    data: {
      shopId: shop1.id,
      name: "Pack Famille (4 pers.)",
      description: "Rôti de veau + poulet fermier + accompagnement pour 4 personnes",
      imageUrl: IMG.packs.famille,
      priceCents: 4590,
      proPriceCents: 3800,
      stockQty: 5,
      sortOrder: 2,
    },
  });
  await Promise.all([
    prisma.packItem.create({ data: { packId: pack2.id, productId: s1Products[6].id, quantity: 1, unit: ProductUnit.KG, weightGrams: 1000 } }),
    prisma.packItem.create({ data: { packId: pack2.id, productId: s1Products[5].id, quantity: 1, unit: ProductUnit.PIECE } }),
  ]);

  const pack3 = await prisma.pack.create({
    data: {
      shopId: shop2.id,
      name: "Pack Raclette Charcutier",
      description: "Assortiment diots, jambon sec et viande séchée pour raclette",
      imageUrl: IMG.packs.raclette,
      priceCents: 3490,
      proPriceCents: 2800,
      stockQty: 8,
      sortOrder: 1,
    },
  });
  await Promise.all([
    prisma.packItem.create({ data: { packId: pack3.id, productId: s2Products[0].id, quantity: 2, unit: ProductUnit.BARQUETTE } }),
    prisma.packItem.create({ data: { packId: pack3.id, productId: s2Products[3].id, quantity: 1, unit: ProductUnit.KG, weightGrams: 300 } }),
  ]);

  console.log("   ✅ 3 packs created");

  // ═══════════════════════════════════════════
  // 5. OFFERS (Dernière minute)
  // ═══════════════════════════════════════════

  console.log("🔥 Creating last-minute offers...");

  await Promise.all([
    prisma.offer.create({
      data: {
        shopId: shop1.id,
        productId: s1Products[0].id,
        name: "Entrecôte maturée 21j — Fin de journée",
        description: "Dernières entrecôtes du jour, à saisir !",
        imageUrl: IMG.offers.dm1,
        originalCents: 3200,
        discountCents: 2200,
        quantity: 5,
        remainingQty: 3,
        expiresAt: hoursFromNow(2),
        isSponsored: true,
      },
    }),
    prisma.offer.create({
      data: {
        shopId: shop2.id,
        productId: s2Products[0].id,
        name: "Diots de Savoie — Promo du jour",
        description: "Barquette de 6 diots à prix cassé",
        imageUrl: IMG.offers.dm2,
        originalCents: 990,
        discountCents: 590,
        quantity: 8,
        remainingQty: 5,
        expiresAt: hoursFromNow(4),
        isSponsored: false,
      },
    }),
    prisma.offer.create({
      data: {
        shopId: shop3.id,
        productId: s3Products[0].id,
        name: "Entrecôte bio — Dernière minute",
        description: "Restant du jour, qualité exceptionnelle",
        imageUrl: IMG.offers.dm3,
        originalCents: 3900,
        discountCents: 2790,
        quantity: 3,
        remainingQty: 2,
        expiresAt: hoursFromNow(1.5),
        isSponsored: false,
      },
    }),
  ]);

  console.log("   ✅ 3 offers created");

  // ═══════════════════════════════════════════
  // 6. PRO ACCOUNTS
  // ═══════════════════════════════════════════

  console.log("💼 Creating pro accounts...");

  await Promise.all([
    prisma.proAccount.create({
      data: {
        userId: pros[0].id, // Bob Burger
        shopId: shop1.id,
        isEnabled: true,
        limitCents: 500000, // 5000 €
        balanceCents: 178500,
        dueDateDays: 30,
      },
    }),
    prisma.proAccount.create({
      data: {
        userId: pros[1].id, // Le Chalet Savoyard
        shopId: shop1.id,
        isEnabled: true,
        limitCents: 300000,
        balanceCents: 82000,
        dueDateDays: 15,
      },
    }),
    prisma.proAccount.create({
      data: {
        userId: pros[2].id, // Traiteur Alpin
        shopId: shop2.id,
        isEnabled: true,
        limitCents: 200000,
        balanceCents: 45600,
        dueDateDays: 30,
      },
    }),
  ]);

  console.log("   ✅ 3 pro accounts created");

  // ═══════════════════════════════════════════
  // 7. FAVORITES
  // ═══════════════════════════════════════════

  console.log("❤️  Creating favorites...");

  await Promise.all([
    prisma.favorite.create({ data: { userId: particuliers[0].id, shopId: shop1.id } }),
    prisma.favorite.create({ data: { userId: particuliers[0].id, shopId: shop3.id } }),
    prisma.favorite.create({ data: { userId: particuliers[2].id, shopId: shop2.id } }),
    prisma.favorite.create({ data: { userId: pros[0].id, shopId: shop1.id } }),
    prisma.favorite.create({ data: { userId: pros[1].id, shopId: shop1.id } }),
  ]);

  console.log("   ✅ 5 favorites created");

  // ═══════════════════════════════════════════
  // 8. ORDERS (various statuses for demo)
  // ═══════════════════════════════════════════

  console.log("📋 Creating demo orders...");

  // Order 1: READY (Marie, particulier)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "CB-20240615-001",
      shopId: shop1.id,
      userId: particuliers[0].id,
      status: OrderStatus.READY,
      paymentStatus: PaymentStatus.COMPLETED,
      paymentMethod: PaymentMethod.CB_ONLINE,
      subtotalCents: 4580,
      totalCents: 4580,
      estimatedReadyAt: minutesAgo(5),
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Products[0].id, name: "Entrecôte", imageUrl: IMG.products.entrecote, unit: ProductUnit.KG, quantity: 2, requestedWeight: 500, actualWeight: 520, unitPriceCents: 3200, totalPriceCents: 3200, adjustedPriceCents: 3328, weightDeviation: 4.0, needsValidation: false } }),
    prisma.orderItem.create({ data: { orderId: order1.id, productId: s1Products[3].id, name: "Merguez maison", imageUrl: IMG.products.merguez, unit: ProductUnit.BARQUETTE, quantity: 1, unitPriceCents: 890, totalPriceCents: 890, needsValidation: false } }),
  ]);
  await Promise.all([
    prisma.timelineEvent.create({ data: { orderId: order1.id, status: OrderStatus.PENDING, message: "Commande passée", createdAt: minutesAgo(50) } }),
    prisma.timelineEvent.create({ data: { orderId: order1.id, status: OrderStatus.ACCEPTED, message: "Commande acceptée par le boucher", createdAt: minutesAgo(48) } }),
    prisma.timelineEvent.create({ data: { orderId: order1.id, status: OrderStatus.PREPARING, message: "Préparation en cours", createdAt: minutesAgo(45) } }),
    prisma.timelineEvent.create({ data: { orderId: order1.id, status: OrderStatus.WEIGHING, message: "Pesée en cours", createdAt: minutesAgo(30) } }),
    prisma.timelineEvent.create({ data: { orderId: order1.id, status: OrderStatus.READY, message: "Commande prête ! Présentez-vous au comptoir.", createdAt: minutesAgo(5) } }),
  ]);

  // Order 2: PREPARING (Bob Burger, PRO)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "CB-20240615-002",
      shopId: shop1.id,
      userId: pros[0].id,
      status: OrderStatus.PREPARING,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.PRO_ACCOUNT,
      subtotalCents: 17850,
      totalCents: 17850,
      estimatedReadyAt: minutesFromNow(15),
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order2.id, productId: s1Products[1].id, name: "Côte de bœuf", imageUrl: IMG.products.coteDeBeuf, unit: ProductUnit.KG, quantity: 5, requestedWeight: 1200, unitPriceCents: 3100, totalPriceCents: 15500, needsValidation: false } }),
    prisma.orderItem.create({ data: { orderId: order2.id, productId: s1Products[6].id, name: "Rôti de veau", imageUrl: IMG.products.roti, unit: ProductUnit.KG, quantity: 1, requestedWeight: 3000, unitPriceCents: 2300, totalPriceCents: 6900, needsValidation: false } }),
  ]);
  await Promise.all([
    prisma.timelineEvent.create({ data: { orderId: order2.id, status: OrderStatus.PENDING, message: "Commande passée", createdAt: minutesAgo(12) } }),
    prisma.timelineEvent.create({ data: { orderId: order2.id, status: OrderStatus.ACCEPTED, message: "Commande acceptée", createdAt: minutesAgo(10) } }),
    prisma.timelineEvent.create({ data: { orderId: order2.id, status: OrderStatus.PREPARING, message: "Préparation en cours", detail: "Bob's Burgers — Commande PRO", createdAt: minutesAgo(8) } }),
  ]);

  // Order 3: WEIGHT_REVIEW (Pierre, attente validation +12%)
  const order3 = await prisma.order.create({
    data: {
      orderNumber: "CB-20240615-003",
      shopId: shop1.id,
      userId: particuliers[1].id,
      status: OrderStatus.WEIGHT_REVIEW,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CB_ONLINE,
      subtotalCents: 3200,
      totalCents: 3200,
      weightAdjCents: 384,
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order3.id, productId: s1Products[0].id, name: "Entrecôte", imageUrl: IMG.products.entrecote, unit: ProductUnit.KG, quantity: 1, requestedWeight: 500, actualWeight: 560, unitPriceCents: 3200, totalPriceCents: 1600, adjustedPriceCents: 1792, weightDeviation: 12.0, needsValidation: true } }),
  ]);
  await Promise.all([
    prisma.timelineEvent.create({ data: { orderId: order3.id, status: OrderStatus.PENDING, message: "Commande passée", createdAt: minutesAgo(20) } }),
    prisma.timelineEvent.create({ data: { orderId: order3.id, status: OrderStatus.ACCEPTED, message: "Commande acceptée", createdAt: minutesAgo(18) } }),
    prisma.timelineEvent.create({ data: { orderId: order3.id, status: OrderStatus.WEIGHING, message: "Pesée en cours", createdAt: minutesAgo(15) } }),
    prisma.timelineEvent.create({ data: { orderId: order3.id, status: OrderStatus.WEIGHT_REVIEW, message: "Ajustement poids > +10% — Validation requise", detail: "Entrecôte : demandé 500g, pesé 560g (+12%). Nouveau prix : 17,92 € au lieu de 16,00 €", createdAt: minutesAgo(14) } }),
  ]);

  // Order 4: STOCK_ISSUE (Sophie)
  const order4 = await prisma.order.create({
    data: {
      orderNumber: "CB-20240615-004",
      shopId: shop2.id,
      userId: particuliers[2].id,
      status: OrderStatus.STOCK_ISSUE,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CB_ONLINE,
      subtotalCents: 2370,
      totalCents: 2370,
    },
  });
  await Promise.all([
    prisma.orderItem.create({ data: { orderId: order4.id, productId: s2Products[2].id, name: "Paupiettes de veau", imageUrl: IMG.products.paupiettes, unit: ProductUnit.PIECE, quantity: 4, unitPriceCents: 590, totalPriceCents: 2360, needsValidation: false, stockAction: "CONTACT" } }),
  ]);
  await Promise.all([
    prisma.timelineEvent.create({ data: { orderId: order4.id, status: OrderStatus.PENDING, message: "Commande passée", createdAt: minutesAgo(30) } }),
    prisma.timelineEvent.create({ data: { orderId: order4.id, status: OrderStatus.ACCEPTED, message: "Commande acceptée", createdAt: minutesAgo(28) } }),
    prisma.timelineEvent.create({ data: { orderId: order4.id, status: OrderStatus.STOCK_ISSUE, message: "Rupture de stock partielle", detail: "Paupiettes de veau : 2 disponibles sur 4 commandées. Action requise.", createdAt: minutesAgo(25) } }),
  ]);

  // Order 5: COLLECTED (ancien, Le Chalet Savoyard PRO)
  const order5 = await prisma.order.create({
    data: {
      orderNumber: "CB-20240614-005",
      shopId: shop1.id,
      userId: pros[1].id,
      status: OrderStatus.COLLECTED,
      paymentStatus: PaymentStatus.COMPLETED,
      paymentMethod: PaymentMethod.PRO_ACCOUNT,
      subtotalCents: 6720,
      totalCents: 6720,
      collectedAt: minutesAgo(1440), // hier
    },
  });
  await prisma.orderItem.create({ data: { orderId: order5.id, packId: pack1.id, name: "Pack BBQ Savoyard", imageUrl: IMG.packs.bbq, unit: ProductUnit.PIECE, quantity: 2, unitPriceCents: 3200, totalPriceCents: 6400, needsValidation: false } });
  await Promise.all([
    prisma.timelineEvent.create({ data: { orderId: order5.id, status: OrderStatus.PENDING, message: "Commande passée", createdAt: minutesAgo(1500) } }),
    prisma.timelineEvent.create({ data: { orderId: order5.id, status: OrderStatus.ACCEPTED, message: "Commande acceptée", createdAt: minutesAgo(1498) } }),
    prisma.timelineEvent.create({ data: { orderId: order5.id, status: OrderStatus.PREPARING, message: "Préparation en cours", createdAt: minutesAgo(1490) } }),
    prisma.timelineEvent.create({ data: { orderId: order5.id, status: OrderStatus.READY, message: "Commande prête", createdAt: minutesAgo(1470) } }),
    prisma.timelineEvent.create({ data: { orderId: order5.id, status: OrderStatus.COLLECTED, message: "Commande retirée", createdAt: minutesAgo(1440) } }),
  ]);

  // Order 6: CANCELLED
  const order6 = await prisma.order.create({
    data: {
      orderNumber: "CB-20240614-006",
      shopId: shop2.id,
      userId: particuliers[3].id,
      status: OrderStatus.CANCELLED,
      paymentStatus: PaymentStatus.REFUNDED,
      paymentMethod: PaymentMethod.CB_ONLINE,
      subtotalCents: 1580,
      totalCents: 1580,
    },
  });
  await prisma.orderItem.create({ data: { orderId: order6.id, productId: s2Products[0].id, name: "Diots de Savoie", imageUrl: IMG.products.saucisses, unit: ProductUnit.BARQUETTE, quantity: 2, unitPriceCents: 990, totalPriceCents: 1980, needsValidation: false } });
  await Promise.all([
    prisma.timelineEvent.create({ data: { orderId: order6.id, status: OrderStatus.PENDING, message: "Commande passée", createdAt: minutesAgo(2000) } }),
    prisma.timelineEvent.create({ data: { orderId: order6.id, status: OrderStatus.CANCELLED, message: "Commande annulée par le client", createdAt: minutesAgo(1990) } }),
  ]);

  // Order 7: PENDING (guest, no account)
  const order7 = await prisma.order.create({
    data: {
      orderNumber: "CB-20240615-007",
      shopId: shop1.id,
      guestPhone: "+33699887766",
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CASH,
      subtotalCents: 1490,
      totalCents: 1490,
    },
  });
  await prisma.orderItem.create({ data: { orderId: order7.id, productId: s1Products[5].id, name: "Poulet fermier entier", imageUrl: IMG.products.poulet, unit: ProductUnit.PIECE, quantity: 1, unitPriceCents: 1490, totalPriceCents: 1490, needsValidation: false } });
  await prisma.timelineEvent.create({ data: { orderId: order7.id, status: OrderStatus.PENDING, message: "Commande passée (invité)", detail: "Paiement en espèces au retrait", createdAt: minutesAgo(2) } });

  console.log("   ✅ 7 orders created (READY, PREPARING, WEIGHT_REVIEW, STOCK_ISSUE, COLLECTED, CANCELLED, PENDING)");

  // ═══════════════════════════════════════════
  // 9. PAYMENTS (mock)
  // ═══════════════════════════════════════════

  console.log("💳 Creating mock payments...");

  await Promise.all([
    prisma.payment.create({ data: { orderId: order1.id, amountCents: 4580, method: PaymentMethod.CB_ONLINE, status: PaymentStatus.COMPLETED, providerRef: "mock_pi_001" } }),
    prisma.payment.create({ data: { orderId: order2.id, amountCents: 17850, method: PaymentMethod.PRO_ACCOUNT, status: PaymentStatus.PENDING, providerRef: "mock_pa_002" } }),
    prisma.payment.create({ data: { orderId: order3.id, amountCents: 3200, method: PaymentMethod.CB_ONLINE, status: PaymentStatus.PENDING, providerRef: "mock_pi_003" } }),
    prisma.payment.create({ data: { orderId: order5.id, amountCents: 6720, method: PaymentMethod.PRO_ACCOUNT, status: PaymentStatus.COMPLETED, providerRef: "mock_pa_005" } }),
    prisma.payment.create({ data: { orderId: order6.id, amountCents: 1580, method: PaymentMethod.CB_ONLINE, status: PaymentStatus.REFUNDED, providerRef: "mock_pi_006" } }),
  ]);

  console.log("   ✅ 5 payments created");

  // ═══════════════════════════════════════════
  // 10. NOTIFICATIONS (stubs)
  // ═══════════════════════════════════════════

  console.log("🔔 Creating stub notifications...");

  await Promise.all([
    prisma.notification.create({ data: { userId: particuliers[0].id, orderId: order1.id, channel: NotificationChannel.SMS, title: "Commande prête !", body: "Votre commande CB-20240615-001 est prête. Rendez-vous chez Savoie Tradition.", sentAt: minutesAgo(5) } }),
    prisma.notification.create({ data: { userId: pros[0].id, orderId: order2.id, channel: NotificationChannel.WHATSAPP, title: "Commande en préparation", body: "Votre commande PRO CB-20240615-002 est en cours de préparation. Prête dans ~15 min.", sentAt: minutesAgo(8) } }),
    prisma.notification.create({ data: { userId: particuliers[1].id, orderId: order3.id, channel: NotificationChannel.SMS, title: "Validation requise", body: "Le poids de votre entrecôte dépasse +10%. Merci de valider le nouveau prix.", sentAt: minutesAgo(14) } }),
  ]);

  console.log("   ✅ 3 notifications created");

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════

  console.log("\n═══════════════════════════════════════════");
  console.log("🌱 SEED COMPLETE!");
  console.log("═══════════════════════════════════════════");
  console.log(`   👤 Users:         20 (3 bouchers + 12 particuliers + 5 pros)`);
  console.log(`   🏪 Shops:         3 (Chambéry)`);
  console.log(`   🕐 Hours:         21`);
  console.log(`   🥩 Products:      ${allProducts.length}`);
  console.log(`   📦 Packs:         3`);
  console.log(`   🔥 Offers:        3 (dernière minute)`);
  console.log(`   💼 Pro Accounts:  3`);
  console.log(`   ❤️  Favorites:     5`);
  console.log(`   📋 Orders:        7 (all statuses)`);
  console.log(`   💳 Payments:      5`);
  console.log(`   🔔 Notifications: 3`);
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
