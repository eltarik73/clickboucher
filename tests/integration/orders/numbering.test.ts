// @vitest-environment node
// Order, ticket and customer numbers allocated inside the order transaction, on real PostgreSQL:
// concurrency, rollback, Paris calendar, and the unique-violation reader used for idempotency.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { uniqueViolationFields } from "@/lib/prisma-errors";
import {
  allocateCustomerNumber,
  allocateDailyNumber,
  allocateOrderNumber,
} from "@/lib/services/orders/numbering";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

// Parallel transactions queue for the pool's connections and for the counter row lock.
const PARALLEL_TX = { maxWait: 60_000, timeout: 60_000 } as const;

function inTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, PARALLEL_TX);
}

function times<T>(n: number, fn: (index: number) => Promise<T>): Promise<T[]> {
  return Promise.all(Array.from({ length: n }, (_, index) => fn(index)));
}

class Rollback extends Error {}

// 2026-11-13 11:00 in Paris.
const NOW = new Date("2026-11-13T10:00:00Z");
// 2026-12-31 23:30 UTC is 2027-01-01 00:30 in Paris.
const NEW_YEAR_EVE_UTC = new Date("2026-12-31T23:30:00Z");

describe("allocateOrderNumber", () => {
  it("gives 50 parallel transactions 50 distinct consecutive numbers in the KG26- format", async () => {
    const numbers = await times(50, () => inTx((tx) => allocateOrderNumber(tx, NOW)));

    const expected = Array.from({ length: 50 }, (_, i) => `KG26-${String(i + 1).padStart(6, "0")}`);
    expect([...numbers].sort()).toEqual(expected);
    const counter = await prisma.orderNumberCounter.findUniqueOrThrow({ where: { year: 2026 } });
    expect(counter.lastNumber).toBe(50);
  });

  it("does not consume the number of a transaction that rolls back", async () => {
    expect(await inTx((tx) => allocateOrderNumber(tx, NOW))).toBe("KG26-000001");

    let allocatedInRolledBack: string | null = null;
    await expect(
      inTx(async (tx) => {
        allocatedInRolledBack = await allocateOrderNumber(tx, NOW);
        throw new Rollback("order not created");
      })
    ).rejects.toBeInstanceOf(Rollback);
    expect(allocatedInRolledBack).toBe("KG26-000002");

    expect(await inTx((tx) => allocateOrderNumber(tx, NOW))).toBe("KG26-000002");
  });

  it("continues after the counter seeded by the migration", async () => {
    await prisma.orderNumberCounter.create({ data: { year: 2026, lastNumber: 165 } });
    expect(await inTx((tx) => allocateOrderNumber(tx, NOW))).toBe("KG26-000166");
  });

  it("uses the Paris year: 31 December 23:30 UTC is already next year", async () => {
    await prisma.orderNumberCounter.create({ data: { year: 2026, lastNumber: 400 } });
    expect(await inTx((tx) => allocateOrderNumber(tx, NEW_YEAR_EVE_UTC))).toBe("KG27-000001");
    const counter2026 = await prisma.orderNumberCounter.findUniqueOrThrow({
      where: { year: 2026 },
    });
    expect(counter2026.lastNumber).toBe(400);
  });
});

describe("allocateDailyNumber", () => {
  it("gives 20 parallel transactions of one shop the numbers 1 to 20", async () => {
    const shop = await createTestShop();
    const results = await times(20, () => inTx((tx) => allocateDailyNumber(tx, shop.id, NOW)));

    expect(results.map((r) => r.dailyNumber).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1)
    );
    for (const result of results) {
      expect(result.displayNumber).toBe(`#${String(result.dailyNumber).padStart(3, "0")}`);
    }
    const counters = await prisma.dailyCounter.findMany({ where: { shopId: shop.id } });
    expect(counters).toHaveLength(1);
    expect(counters[0].lastNumber).toBe(20);
  });

  it("keys the counter by the Paris date: 31 December 23:30 UTC counts for 1 January", async () => {
    const shop = await createTestShop();
    await prisma.dailyCounter.create({
      data: { shopId: shop.id, date: new Date("2026-12-31T00:00:00Z"), lastNumber: 37 },
    });

    expect(await inTx((tx) => allocateDailyNumber(tx, shop.id, NEW_YEAR_EVE_UTC))).toEqual({
      dailyNumber: 1,
      displayNumber: "#001",
    });
    const rows = await prisma.dailyCounter.findMany({
      where: { shopId: shop.id },
      orderBy: { date: "asc" },
    });
    expect(rows.map((r) => [r.date.toISOString().slice(0, 10), r.lastNumber])).toEqual([
      ["2026-12-31", 37],
      ["2027-01-01", 1],
    ]);
  });

  it("counts each shop separately and does not consume a rolled-back number", async () => {
    const [shopA, shopB] = [await createTestShop(), await createTestShop()];
    await inTx((tx) => allocateDailyNumber(tx, shopA.id, NOW));
    await expect(
      inTx(async (tx) => {
        await allocateDailyNumber(tx, shopA.id, NOW);
        throw new Rollback("order not created");
      })
    ).rejects.toBeInstanceOf(Rollback);

    expect((await inTx((tx) => allocateDailyNumber(tx, shopA.id, NOW))).dailyNumber).toBe(2);
    expect((await inTx((tx) => allocateDailyNumber(tx, shopB.id, NOW))).dailyNumber).toBe(1);
  });
});

describe("allocateCustomerNumber", () => {
  it("returns the same number on a second call for the same shop and customer", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();

    const first = await inTx((tx) => allocateCustomerNumber(tx, shop.id, customer.id));
    const second = await inTx((tx) => allocateCustomerNumber(tx, shop.id, customer.id));

    expect(first).toBe(1);
    expect(second).toBe(1);
    const counter = await prisma.customerCounter.findUniqueOrThrow({ where: { shopId: shop.id } });
    expect(counter.lastNumber).toBe(1);
  });

  it("gives number 1 to the first customer of each shop", async () => {
    const [shopA, shopB] = [await createTestShop(), await createTestShop()];
    const [alice, bob] = [await createTestUser(), await createTestUser()];

    expect(await inTx((tx) => allocateCustomerNumber(tx, shopA.id, alice.id))).toBe(1);
    expect(await inTx((tx) => allocateCustomerNumber(tx, shopB.id, bob.id))).toBe(1);
  });

  it("gives a customer ordering at two shops one row in each, without a conflict", async () => {
    const [shopA, shopB] = [await createTestShop(), await createTestShop()];
    const [earlier, customer] = [await createTestUser(), await createTestUser()];
    await inTx((tx) => allocateCustomerNumber(tx, shopA.id, earlier.id));

    expect(await inTx((tx) => allocateCustomerNumber(tx, shopA.id, customer.id))).toBe(2);
    expect(await inTx((tx) => allocateCustomerNumber(tx, shopB.id, customer.id))).toBe(1);

    const rows = await prisma.shopCustomer.findMany({
      where: { userId: customer.id },
      orderBy: { number: "asc" },
    });
    expect(rows.map((r) => [r.shopId, r.number])).toEqual([
      [shopB.id, 1],
      [shopA.id, 2],
    ]);
  });

  it("gives 10 parallel first orders of the SAME customer the same number and one row", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();

    const numbers = await times(10, () =>
      inTx((tx) => allocateCustomerNumber(tx, shop.id, customer.id))
    );

    expect(new Set(numbers).size).toBe(1);
    const rows = await prisma.shopCustomer.findMany({ where: { shopId: shop.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: customer.id, number: numbers[0] });
  });

  it("gives 10 different customers of one shop 10 distinct numbers in parallel", async () => {
    const shop = await createTestShop();
    const customers = [];
    for (let i = 0; i < 10; i += 1) customers.push(await createTestUser());

    const numbers = await Promise.all(
      customers.map((customer) => inTx((tx) => allocateCustomerNumber(tx, shop.id, customer.id)))
    );

    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(await prisma.shopCustomer.count({ where: { shopId: shop.id } })).toBe(10);
  });

  it("continues above the shop counter raised by the migration", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    await prisma.customerCounter.create({ data: { shopId: shop.id, lastNumber: 28 } });

    expect(await inTx((tx) => allocateCustomerNumber(tx, shop.id, customer.id))).toBe(29);
  });

  it("does not keep the number of a rolled-back first order", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    await expect(
      inTx(async (tx) => {
        await allocateCustomerNumber(tx, shop.id, customer.id);
        throw new Rollback("order not created");
      })
    ).rejects.toBeInstanceOf(Rollback);

    expect(await prisma.shopCustomer.count()).toBe(0);
    expect(await inTx((tx) => allocateCustomerNumber(tx, shop.id, customer.id))).toBe(1);
  });
});

describe("uniqueViolationFields", () => {
  it("reads meta.target of a duplicate orders.idempotency_key: the database column name", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const key = "6f1c2b9e-0d4a-4f7e-9a51-3b2c8d7e6f10";
    await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      overrides: { idempotencyKey: key },
    });

    const error = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      overrides: { idempotencyKey: key },
    }).then(
      () => null,
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const known = error as Prisma.PrismaClientKnownRequestError;
    expect(known.code).toBe("P2002");
    // What Prisma 6.19 reports on PostgreSQL for this constraint: the column name, not the
    // schema.prisma field name (idempotencyKey).
    expect(known.meta?.target).toEqual(["idempotency_key"]);
    expect(uniqueViolationFields(error)).toEqual(["idempotency_key"]);
  });

  it("returns null for any error that is not a unique violation", async () => {
    const notFound = await prisma.order.findUniqueOrThrow({ where: { id: "missing" } }).then(
      () => null,
      (caught: unknown) => caught
    );
    expect(notFound).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(uniqueViolationFields(notFound)).toBeNull();
    expect(uniqueViolationFields(new Error("P2002"))).toBeNull();
    expect(uniqueViolationFields(null)).toBeNull();
  });
});
