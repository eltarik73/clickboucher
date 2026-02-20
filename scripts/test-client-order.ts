/**
 * 🧪 KLIK&GO — Client Order Test Script
 * Simulates a client placing an order end-to-end.
 *
 * Usage: npx tsx scripts/test-client-order.ts
 * Requires: DATABASE_URL env var (uses Prisma directly)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n═══════════════════════════════════════");
  console.log("🧪 TEST CLIENT — Commande complète");
  console.log("═══════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  // 1. Find a shop
  console.log("1️⃣  Recherche d'une boutique...");
  const shop = await prisma.shop.findFirst({
    where: { visible: true },
    include: { products: { where: { inStock: true }, take: 5 } },
  });

  if (!shop) {
    console.log("❌ Aucune boutique visible trouvée");
    failed++;
    return printResult(passed, failed);
  }
  console.log(`   ✅ Boutique trouvée : ${shop.name} (${shop.id})`);
  passed++;

  // 2. Check products
  console.log("\n2️⃣  Vérification des produits...");
  if (shop.products.length === 0) {
    console.log("❌ Aucun produit en stock");
    failed++;
    return printResult(passed, failed);
  }
  console.log(`   ✅ ${shop.products.length} produit(s) en stock`);
  for (const p of shop.products.slice(0, 3)) {
    console.log(`      - ${p.name} : ${(p.priceCents / 100).toFixed(2)}€/${p.unit}`);
  }
  passed++;

  // 3. Find or create a test user
  console.log("\n3️⃣  Recherche d'un utilisateur test...");
  let user = await prisma.user.findFirst({
    where: { email: { contains: "test" } },
  });
  if (!user) {
    user = await prisma.user.findFirst({ where: { role: "CLIENT" } });
  }
  if (!user) {
    console.log("❌ Aucun utilisateur trouvé pour tester");
    failed++;
    return printResult(passed, failed);
  }
  console.log(`   ✅ Utilisateur : ${user.firstName} ${user.lastName} (${user.email})`);
  passed++;

  // 4. Create an order
  console.log("\n4️⃣  Création d'une commande...");
  const items = shop.products.slice(0, Math.min(3, shop.products.length));
  const orderItems = items.map((p) => ({
    productId: p.id,
    name: p.name,
    quantity: p.unit === "KG" ? 1 : 2,
    unit: p.unit,
    priceCents: p.priceCents,
    totalCents: p.unit === "KG" ? p.priceCents : p.priceCents * 2,
    weightGrams: p.unit === "KG" ? 500 : null,
  }));

  const totalCents = orderItems.reduce((sum, i) => sum + i.totalCents, 0);
  const orderNumber = `KG-TEST-${Date.now().toString(36).toUpperCase()}`;

  try {
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        shopId: shop.id,
        status: "PENDING",
        totalCents,
        paymentMethod: "ON_PICKUP",
        customerNote: "Commande test automatique — pas trop épicé svp",
        items: {
          create: orderItems.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            priceCents: i.priceCents,
            totalCents: i.totalCents,
            weightGrams: i.weightGrams,
          })),
        },
      },
      include: { items: true },
    });

    console.log(`   ✅ Commande créée : ${order.orderNumber}`);
    console.log(`      ID: ${order.id}`);
    console.log(`      Statut: ${order.status}`);
    console.log(`      Total: ${(order.totalCents / 100).toFixed(2)}€`);
    console.log(`      Items: ${order.items.length}`);
    passed++;

    // 5. Verify order data
    console.log("\n5️⃣  Vérification des données...");
    const fetched = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, shop: true, user: true },
    });

    if (!fetched) {
      console.log("❌ Commande introuvable après création");
      failed++;
    } else if (fetched.status !== "PENDING") {
      console.log(`❌ Statut incorrect : ${fetched.status} (attendu: PENDING)`);
      failed++;
    } else if (fetched.items.length !== orderItems.length) {
      console.log(`❌ Nombre d'items incorrect : ${fetched.items.length} (attendu: ${orderItems.length})`);
      failed++;
    } else {
      console.log("   ✅ Données vérifiées : statut PENDING, items corrects");
      passed++;
    }

    // Store order ID for boucher test
    console.log(`\n📋 Order ID pour test boucher : ${order.id}`);
  } catch (error) {
    console.log(`❌ Erreur création commande : ${(error as Error).message}`);
    failed++;
  }

  printResult(passed, failed);
}

function printResult(passed: number, failed: number) {
  console.log("\n═══════════════════════════════════════");
  console.log(`📊 Résultat : ${passed} ✅  |  ${failed} ❌`);
  console.log("═══════════════════════════════════════\n");
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error("💥 Erreur fatale :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
