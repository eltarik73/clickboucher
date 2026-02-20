/**
 * 🧪 KLIK&GO — Boucher Order Management Test Script
 * Simulates a boucher processing an order through all stages.
 *
 * Usage: npx tsx scripts/test-boucher-order.ts
 * Requires: DATABASE_URL env var (uses Prisma directly)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n═══════════════════════════════════════");
  console.log("🧪 TEST BOUCHER — Gestion commande");
  console.log("═══════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  // 1. Find a PENDING order
  console.log("1️⃣  Recherche d'une commande PENDING...");
  let order = await prisma.order.findFirst({
    where: { status: "PENDING" },
    include: { items: true, shop: true },
    orderBy: { createdAt: "desc" },
  });

  if (!order) {
    console.log("   ⚠️  Aucune commande PENDING, création d'une commande test...");
    const shop = await prisma.shop.findFirst({
      where: { visible: true },
      include: { products: { where: { inStock: true }, take: 2 } },
    });
    const user = await prisma.user.findFirst({ where: { role: "CLIENT" } });

    if (!shop || !user || shop.products.length === 0) {
      console.log("❌ Impossible de créer une commande test (pas de shop/user/produits)");
      failed++;
      return printResult(passed, failed);
    }

    order = await prisma.order.create({
      data: {
        orderNumber: `KG-BTEST-${Date.now().toString(36).toUpperCase()}`,
        userId: user.id,
        shopId: shop.id,
        status: "PENDING",
        totalCents: shop.products[0].priceCents * 2,
        paymentMethod: "ON_PICKUP",
        items: {
          create: shop.products.slice(0, 2).map((p) => ({
            productId: p.id,
            name: p.name,
            quantity: 1,
            unit: p.unit,
            priceCents: p.priceCents,
            totalCents: p.priceCents,
          })),
        },
      },
      include: { items: true, shop: true },
    });
  }

  console.log(`   ✅ Commande trouvée : ${order.orderNumber} (${order.status})`);
  passed++;

  // 2. ACCEPT the order (PENDING → ACCEPTED)
  console.log("\n2️⃣  Acceptation de la commande (PENDING → ACCEPTED)...");
  try {
    const estimatedReady = new Date(Date.now() + 15 * 60_000);
    const accepted = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "ACCEPTED",
        estimatedReady,
        qrCode: crypto.randomUUID(),
      },
    });

    if (accepted.status === "ACCEPTED" && accepted.estimatedReady) {
      console.log(`   ✅ Accept : OK (PENDING → ${accepted.status})`);
      console.log(`      estimatedReady: ${accepted.estimatedReady.toLocaleTimeString()}`);
      passed++;
    } else {
      console.log(`   ❌ Accept : statut inattendu ${accepted.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Accept : ERREUR - ${(error as Error).message}`);
    failed++;
  }

  // 3. Update prep time (ACCEPTED, adjust estimatedReady)
  console.log("\n3️⃣  Modification du temps de préparation (15 → 20 min)...");
  try {
    const newEstimatedReady = new Date(Date.now() + 20 * 60_000);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { estimatedReady: newEstimatedReady },
    });

    if (updated.estimatedReady) {
      console.log(`   ✅ Prep time : OK (estimatedReady mis à jour)`);
      passed++;
    } else {
      console.log("   ❌ Prep time : estimatedReady non défini");
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Prep time : ERREUR - ${(error as Error).message}`);
    failed++;
  }

  // 4. Start PREPARING (ACCEPTED → PREPARING)
  console.log("\n4️⃣  Lancement préparation (ACCEPTED → PREPARING)...");
  try {
    const preparing = await prisma.order.update({
      where: { id: order.id },
      data: { status: "PREPARING" },
    });

    if (preparing.status === "PREPARING") {
      console.log(`   ✅ Preparing : OK (ACCEPTED → ${preparing.status})`);
      passed++;
    } else {
      console.log(`   ❌ Preparing : statut inattendu ${preparing.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Preparing : ERREUR - ${(error as Error).message}`);
    failed++;
  }

  // 5. Mark READY (PREPARING → READY)
  console.log("\n5️⃣  Commande prête (PREPARING → READY)...");
  try {
    const ready = await prisma.order.update({
      where: { id: order.id },
      data: { status: "READY", actualReady: new Date() },
    });

    if (ready.status === "READY" && ready.actualReady) {
      console.log(`   ✅ Ready : OK (PREPARING → ${ready.status})`);
      console.log(`      actualReady: ${ready.actualReady.toLocaleTimeString()}`);
      passed++;
    } else {
      console.log(`   ❌ Ready : statut inattendu ${ready.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Ready : ERREUR - ${(error as Error).message}`);
    failed++;
  }

  // 6. Mark PICKED_UP (READY → PICKED_UP)
  console.log("\n6️⃣  Retrait client (READY → PICKED_UP)...");
  try {
    const pickedUp = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PICKED_UP",
        pickedUpAt: new Date(),
        qrScannedAt: new Date(),
      },
    });

    if (pickedUp.status === "PICKED_UP" && pickedUp.pickedUpAt) {
      console.log(`   ✅ Picked up : OK (READY → ${pickedUp.status})`);
      console.log(`      pickedUpAt: ${pickedUp.pickedUpAt.toLocaleTimeString()}`);
      passed++;
    } else {
      console.log(`   ❌ Picked up : statut inattendu ${pickedUp.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Picked up : ERREUR - ${(error as Error).message}`);
    failed++;
  }

  // 7. Verify in history
  console.log("\n7️⃣  Vérification dans l'historique...");
  try {
    const history = await prisma.order.findMany({
      where: {
        shopId: order.shopId,
        status: { in: ["PICKED_UP", "COMPLETED", "DENIED"] },
        createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const found = history.find((h) => h.id === order.id);
    if (found) {
      console.log(`   ✅ Historique : commande ${found.orderNumber} trouvée (${found.status})`);
      console.log(`      Total historique 3 jours : ${history.length} commande(s)`);
      passed++;
    } else {
      console.log("   ❌ Historique : commande non trouvée");
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Historique : ERREUR - ${(error as Error).message}`);
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
