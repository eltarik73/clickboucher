// @vitest-environment node
// Preuve que l'outillage d'intégration fait ce qu'il annonce : connexion au schéma `itest`, verrou
// de lancement, remise à zéro entre les tests, refus de vider un autre schéma, fabriques.
import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { prisma, resetDatabase, useCleanDatabase } from "./helpers/db";
import {
  createTestOffer,
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "./helpers/factories";
import { INTEGRATION_SCHEMA } from "./setup/database-url";
import { RUN_LOCK_NAME } from "./setup/global-setup";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

async function tableNames(): Promise<string[]> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'itest'
  `;
  return tables.map((table) => table.tablename);
}

/** Rows in the whole schema `itest`, every table included. */
async function totalRows(): Promise<number> {
  let total = 0;
  for (const table of await tableNames()) {
    const [{ rows }] = await prisma.$queryRawUnsafe<Array<{ rows: number }>>(
      `SELECT count(*)::int AS "rows" FROM "itest"."${table}"`
    );
    total += rows;
  }
  return total;
}

describe("connexion", () => {
  it("le client de l'application est connecté au schéma itest", async () => {
    const [connection] = await prisma.$queryRaw<Array<{ schema: string | null }>>`
      SELECT current_schema() AS "schema"
    `;

    expect(INTEGRATION_SCHEMA).toBe("itest");
    expect(connection.schema).toBe("itest");
    expect(new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema")).toBe("itest");
    expect(process.env.DIRECT_DATABASE_URL).toBe(process.env.DATABASE_URL);
  });

  it("le schéma itest porte les tables de prisma/schema.prisma", async () => {
    const expected = ["users", "shops", "products", "offers", "orders", "order_items"];

    expect(await tableNames()).toEqual(expect.arrayContaining(expected));
  });
});

describe("verrou de lancement", () => {
  it("le lancement en cours détient le verrou du schéma : un second preneur est refusé", async () => {
    const [attempt] = await prisma.$queryRaw<Array<{ free: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${RUN_LOCK_NAME})) AS "free"
    `;

    expect(attempt.free).toBe(false);
  });
});

describe("resetDatabase", () => {
  it("vide toutes les tables, y compris celles liées par des clés étrangères", async () => {
    const customer = await createTestUser();
    const shop = await createTestShop();
    const product = await createTestProduct(shop.id);
    await createTestOffer();
    const items = [{ productId: product.id }];
    const order = await createTestOrder({ shopId: shop.id, userId: customer.id, items });
    await prisma.orderEvent.create({
      data: { orderId: order.id, shopId: shop.id, type: "CREATED", actorId: customer.id },
    });
    // Client, boucher de la boutique, boutique, produit, offre, commande, ligne, événement.
    expect(await totalRows()).toBe(8);

    await resetDatabase();

    expect(await totalRows()).toBe(0);
  });

  it("useCleanDatabase : un test laisse des lignes derrière lui…", async () => {
    await createTestUser();

    expect(await prisma.user.count()).toBe(1);
  });

  it("… et le test suivant repart d'une base vide", async () => {
    expect(await totalRows()).toBe(0);
  });

  it("refuse de vider un schéma qui n'est pas itest, et ne touche jamais un autre schéma", async () => {
    const outsideUrl = new URL(process.env.DATABASE_URL ?? "");
    outsideUrl.searchParams.set("schema", "itest_guard");
    const outsideClient = new PrismaClient({ datasourceUrl: outsideUrl.toString() });
    // @/lib/prisma réutilise le client rangé dans globalThis : y placer un client connecté à un
    // autre schéma, puis recharger les modules, donne un resetDatabase lié à ce client.
    const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
    const applicationClient = globalForPrisma.prisma;
    const witnessRows = async () => {
      const [{ rows }] = await prisma.$queryRaw<Array<{ rows: number }>>`
        SELECT count(*)::int AS "rows" FROM "itest_guard"."witness"
      `;
      return rows;
    };

    await prisma.$executeRaw`DROP SCHEMA IF EXISTS "itest_guard" CASCADE`;
    await prisma.$executeRaw`CREATE SCHEMA "itest_guard"`;
    await prisma.$executeRaw`CREATE TABLE "itest_guard"."witness" ("id" INTEGER PRIMARY KEY)`;
    await prisma.$executeRaw`INSERT INTO "itest_guard"."witness" ("id") VALUES (1)`;
    try {
      await resetDatabase();
      expect(await witnessRows()).toBe(1);

      vi.resetModules();
      globalForPrisma.prisma = outsideClient;
      const outside = await import("./helpers/db");
      expect(outside.prisma).toBe(outsideClient);

      await expect(outside.resetDatabase()).rejects.toThrow(
        "resetDatabase refuse de vider le schéma « itest_guard »"
      );
      expect(await witnessRows()).toBe(1);
    } finally {
      globalForPrisma.prisma = applicationClient;
      vi.resetModules();
      await outsideClient.$disconnect();
      await prisma.$executeRaw`DROP SCHEMA IF EXISTS "itest_guard" CASCADE`;
    }
  });
});

describe("fabriques", () => {
  it("createTestUser insère un client aux identifiants uniques", async () => {
    const first = await createTestUser();
    const second = await createTestUser();

    expect(await prisma.user.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first);
    expect(first).toMatchObject({ role: "CLIENT", isGuest: false });
    expect(first.clerkId).toEqual(expect.any(String));
    expect(second.email).not.toBe(first.email);
    expect(second.clerkId).not.toBe(first.clerkId);
  });

  it("createTestUser : les valeurs demandées l'emportent", async () => {
    const requested = {
      role: "CLIENT_PRO",
      firstName: "Fatima",
      clerkId: null,
      isGuest: true,
    } as const;

    expect(await createTestUser(requested)).toMatchObject(requested);
  });

  it("createTestShop insère une boutique ouverte, sans acceptation automatique, avec son boucher", async () => {
    const first = await createTestShop();
    const second = await createTestShop();

    expect(await prisma.shop.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first);
    expect(first).toMatchObject({ status: "OPEN", autoAccept: false });
    expect(second.slug).not.toBe(first.slug);
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: first.ownerId } });
    expect(owner.role).toBe("BOUCHER");
    expect(second.ownerId).not.toBe(first.ownerId);
  });

  it("createTestShop ne crée pas de boucher quand ownerId est fourni", async () => {
    const owner = await createTestUser({ role: "BOUCHER" });
    const requested = { ownerId: owner.id, autoAccept: true, name: "Boucherie Tarik" };

    expect(await createTestShop(requested)).toMatchObject(requested);
    expect(await prisma.user.count()).toBe(1);
  });

  it("createTestProduct insère un produit au kilo, en stock, dans la boutique", async () => {
    const shop = await createTestShop();
    const requested = { unit: "BARQUETTE", priceCents: 650, name: "Merguez" } as const;

    const product = await createTestProduct(shop.id);
    const tray = await createTestProduct(shop.id, requested);

    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toEqual(product);
    expect(product).toMatchObject({ shopId: shop.id, unit: "KG", priceCents: 1911, inStock: true });
    expect(tray).toMatchObject({ shopId: shop.id, ...requested });
  });

  it("createTestOffer insère une offre plateforme active autour de maintenant, au code unique", async () => {
    const first = await createTestOffer();
    const second = await createTestOffer();
    const now = Date.now();

    expect(await prisma.offer.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first);
    expect(first).toMatchObject({ type: "PERCENT", discountValue: 10, payer: "KLIKGO" });
    expect(first).toMatchObject({ status: "ACTIVE", shopId: null, currentUses: 0 });
    expect(first.startDate.getTime()).toBeLessThan(now);
    expect(first.endDate.getTime()).toBeGreaterThan(now);
    expect(second.code).not.toBe(first.code);
  });

  it("createTestOffer : les valeurs demandées l'emportent", async () => {
    const shop = await createTestShop();
    const requested = { type: "AMOUNT", discountValue: 5, payer: "BUTCHER", maxUses: 1 } as const;

    const offer = await createTestOffer({ shopId: shop.id, ...requested });

    expect(offer).toMatchObject({ shopId: shop.id, ...requested });
  });

  it("createTestOrder insère une commande en attente au numéro unique", async () => {
    const customer = await createTestUser();
    const shop = await createTestShop();

    const first = await createTestOrder({ shopId: shop.id, userId: customer.id });
    const second = await createTestOrder({ shopId: shop.id, userId: customer.id });

    const where = { id: first.id };
    expect(await prisma.order.findUniqueOrThrow({ where, include: { items: true } })).toEqual(
      first
    );
    expect(first).toMatchObject({ shopId: shop.id, userId: customer.id, status: "PENDING" });
    expect(first).toMatchObject({ totalCents: 0, items: [] });
    expect(first.orderNumber).toMatch(/^IT-\d+$/);
    expect(second.orderNumber).toMatch(/^IT-\d+$/);
    expect(second.orderNumber).not.toBe(first.orderNumber);
  });

  it("createTestOrder décrit chaque ligne d'après son produit et additionne le total", async () => {
    const customer = await createTestUser();
    const shop = await createTestShop();
    const weighed = await createTestProduct(shop.id, { name: "Entrecôte" });
    const tray = { name: "Merguez", unit: "BARQUETTE", priceCents: 650 } as const;
    const counted = await createTestProduct(shop.id, tray);

    const order = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      items: [{ productId: weighed.id }, { productId: counted.id, quantity: 2, totalCents: 1300 }],
    });

    expect(order.items).toHaveLength(2);
    expect(order.items.find((item) => item.productId === weighed.id)).toMatchObject({
      orderId: order.id,
      name: "Entrecôte",
      unit: "KG",
      quantity: 1,
      weightGrams: 1000,
      priceCents: 1911,
      totalCents: 1911,
    });
    expect(order.items.find((item) => item.productId === counted.id)).toMatchObject({
      orderId: order.id,
      ...tray,
      quantity: 2,
      weightGrams: null,
      totalCents: 1300,
    });
    expect(order.totalCents).toBe(3211);
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(2);
  });

  it("createTestOrder : statut et total demandés, puis overrides, l'emportent", async () => {
    const customer = await createTestUser();
    const shop = await createTestShop();
    const product = await createTestProduct(shop.id);
    const overrides = { orderNumber: "KG26-000166", totalCents: 4000, customerNote: "Sans gras" };

    const order = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      status: "READY",
      totalCents: 4200,
      items: [{ productId: product.id }],
      overrides,
    });

    expect(order).toMatchObject({ status: "READY", ...overrides });
  });

  it("createTestOrder refuse un produit d'une autre boutique", async () => {
    const customer = await createTestUser();
    const shop = await createTestShop();
    const otherShop = await createTestShop();
    const items = [{ productId: (await createTestProduct(otherShop.id)).id }];

    await expect(createTestOrder({ shopId: shop.id, userId: customer.id, items })).rejects.toThrow(
      `le produit ${items[0].productId} n'existe pas dans la boutique ${shop.id}`
    );
    expect(await prisma.order.count()).toBe(0);
  });
});
