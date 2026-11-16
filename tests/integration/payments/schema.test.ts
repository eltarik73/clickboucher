// @vitest-environment node
// The payment schema on real PostgreSQL: one order per Stripe session or PaymentIntent (several
// NULLs allowed), a dispute record outlives its order, rows written without the new columns (the
// previous code's writes) get NULL or the declared default, the hand-written migration names every
// index and foreign key exactly as Prisma does, and its preflight (run as it is) accepts the schema
// Prisma builds but refuses two orders sharing a PaymentIntent before the unique index exists, and
// a column already present in another shape than Prisma's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { uniqueViolationFields } from "@/lib/prisma-errors";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const MIGRATION_DIR = path.resolve(
  __dirname,
  "../../../prisma/migrations/20261116120000_c1_paiement_a"
);
const MIGRATION_SQL = readFileSync(path.join(MIGRATION_DIR, "migration.sql"), "utf8");
const PREFLIGHT_SQL = readFileSync(path.join(MIGRATION_DIR, "preflight.sql"), "utf8");

async function orderOf() {
  const shop = await createTestShop();
  const customer = await createTestUser();
  return {
    shop,
    customer,
    create: () => createTestOrder({ shopId: shop.id, userId: customer.id }),
  };
}

/** The rejection of `write`, which must fail. */
async function rejectionOf(write: Promise<unknown>): Promise<unknown> {
  return write.then(
    () => {
      throw new Error("the write was expected to fail");
    },
    (error: unknown) => error
  );
}

describe("a Stripe session or PaymentIntent designates a single order", () => {
  it.each([
    ["stripePaymentIntentId", "stripe_payment_intent_id", "pi_itest_1"],
    ["stripeCheckoutSessionId", "stripe_checkout_session_id", "cs_itest_1"],
  ] as const)(
    "%s: several orders without an identifier, then a duplicate refused",
    async (field, column, value) => {
      const { create } = await orderOf();
      const [first, second, third] = [await create(), await create(), await create()];
      expect([first[field], second[field], third[field]]).toEqual([null, null, null]);

      await prisma.order.update({ where: { id: first.id }, data: { [field]: value } });
      const byUpdate = await rejectionOf(
        prisma.order.update({ where: { id: second.id }, data: { [field]: value } })
      );
      expect(uniqueViolationFields(byUpdate)).toEqual([column]);

      const byInsert = await rejectionOf(
        createTestOrder({
          shopId: first.shopId,
          userId: first.userId,
          overrides: { [field]: value },
        })
      );
      expect(uniqueViolationFields(byInsert)).toEqual([column]);

      const holders = await prisma.order.findMany({
        where: { [field]: value },
        select: { id: true },
      });
      expect(holders).toEqual([{ id: first.id }]);
    }
  );
});

describe("dispute record", () => {
  it("outlives the deletion of its order: orderId set to NULL, the rest kept", async () => {
    const { shop, create } = await orderOf();
    const order = await create();
    const other = await create();
    const fields = {
      chargeId: "ch_itest_1",
      paymentIntentId: "pi_itest_1",
      shopId: shop.id,
      amountCents: 2450,
      currency: "eur",
      reason: "fraudulent",
      status: "needs_response",
      dueBy: new Date("2026-11-30T23:59:59Z"),
      livemode: false,
    };
    const dispute = await prisma.stripeDispute.create({
      data: { id: "du_itest_1", orderId: order.id, ...fields },
    });
    await prisma.stripeDispute.create({ data: { id: "du_itest_2", orderId: other.id, ...fields } });

    await prisma.order.delete({ where: { id: order.id } });

    expect(await prisma.stripeDispute.findUnique({ where: { id: "du_itest_1" } })).toEqual({
      ...dispute,
      orderId: null,
    });
    expect(await prisma.stripeDispute.findUnique({ where: { id: "du_itest_2" } })).toMatchObject({
      orderId: other.id,
    });
  });
});

describe("rows written without the new columns (as the previous code writes them)", () => {
  it("customer without tolerance, shop at its defaults, order without tolerance or online payment", async () => {
    const { shop, customer, create } = await orderOf();
    const order = await create();

    expect(customer.weighTolerance).toBeNull();
    expect(shop).toMatchObject({
      stripeRequirementsDue: [],
      stripeDisabledReason: null,
      stripeCardPaymentsActive: false,
    });
    expect(order).toMatchObject({
      weighToleranceRateBps: null,
      weighToleranceCapCents: null,
      estimatedTotalCents: null,
      stripeChargeId: null,
      authorizedAmountCents: null,
      paymentAuthorizedAt: null,
      captureBefore: null,
      cardNetwork: null,
      capturedAmountCents: null,
      paymentReleasedAt: null,
    });
  });

  it("pending tier-2 adjustment and Stripe event: deadline, reason and ledger columns NULL", async () => {
    const { shop, create } = await orderOf();
    const order = await create();
    const adjustment = await prisma.priceAdjustment.create({
      data: {
        orderId: order.id,
        shopId: shop.id,
        originalTotal: order.totalCents,
        newTotal: order.totalCents + 150,
        adjustmentType: "WEIGHT",
        tier: 2,
        autoApproveAt: new Date(Date.now() + 30_000),
      },
    });
    const event = await prisma.stripeEvent.create({
      data: { id: "evt_itest_1", type: "checkout.session.completed", payload: {} },
    });

    expect(adjustment).toMatchObject({ status: "PENDING", answerBy: null, closeReason: null });
    expect(event).toMatchObject({ handledAt: null, livemode: null, account: null });
  });
});

describe("hand-written migration", () => {
  it("names each index and the foreign key as Prisma creates them", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname IN (
        'orders_stripe_payment_intent_id_key', 'orders_stripe_checkout_session_id_key',
        'price_adjustments_status_answer_by_idx', 'stripe_disputes_pkey',
        'stripe_disputes_order_id_idx', 'stripe_disputes_shop_id_status_idx'
      )
      ORDER BY indexname
    `;
    expect(indexes).toHaveLength(6);
    for (const { indexname } of indexes) {
      expect(MIGRATION_SQL).toContain(`"${indexname}"`);
    }

    const [foreignKey] = await prisma.$queryRaw<Array<{ onDelete: string; onUpdate: string }>>`
      SELECT confdeltype::text AS "onDelete", confupdtype::text AS "onUpdate" FROM pg_constraint
      WHERE conname = 'stripe_disputes_order_id_fkey' AND conrelid = 'stripe_disputes'::regclass
    `;
    expect(foreignKey).toEqual({ onDelete: "n", onUpdate: "c" });
    expect(MIGRATION_SQL).toContain(
      `ADD CONSTRAINT "stripe_disputes_order_id_fkey"\n            FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
  });
});

describe("migration preflight (preflight.sql run as it is)", () => {
  it("accepts the schema built by Prisma, objects already present included", async () => {
    const { create } = await orderOf();
    await create();

    await expect(prisma.$executeRawUnsafe(PREFLIGHT_SQL)).resolves.toBe(0);
  });

  it("refuses two orders with the same PaymentIntent before the unique index, writing nothing", async () => {
    const { create } = await orderOf();
    const [first, second] = [await create(), await create()];

    const refusal = prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('DROP INDEX "orders_stripe_payment_intent_id_key"');
      await tx.order.updateMany({
        where: { id: { in: [first.id, second.id] } },
        data: { stripePaymentIntentId: "pi_itest_dup" },
      });
      await tx.$executeRawUnsafe(PREFLIGHT_SQL);
    });

    await expect(refusal).rejects.toThrow(
      /migration 20261116120000_c1_paiement_a NON appliquée[\s\S]*orders\.stripe_payment_intent_id : 1 valeur\(s\) portée\(s\) par plusieurs commandes \(pi_itest_dup \(2 commandes\)\)/
    );
    const [index] = await prisma.$queryRaw<Array<{ unique: boolean }>>`
      SELECT indisunique AS "unique" FROM pg_index
      WHERE indexrelid = 'orders_stripe_payment_intent_id_key'::regclass
    `;
    expect(index).toEqual({ unique: true });
    expect(await prisma.order.count({ where: { stripePaymentIntentId: { not: null } } })).toBe(0);
  });

  it("refuses a list column already present NOT NULL, a shape db push never builds", async () => {
    const refusal = prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'ALTER TABLE "shops" ALTER COLUMN "stripe_requirements_due" SET NOT NULL'
      );
      await tx.$executeRawUnsafe(PREFLIGHT_SQL);
      // Never commit: db push ignores a list's nullability and would not restore the column.
      throw new Error("the preflight was expected to refuse");
    });

    await expect(refusal).rejects.toThrow(
      /colonne shops\.stripe_requirements_due déjà présente mais NOT NULL, attendu nullable/
    );
    const [column] = await prisma.$queryRaw<Array<{ nullable: string }>>`
      SELECT is_nullable AS nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'shops'
        AND column_name = 'stripe_requirements_due'
    `;
    expect(column).toEqual({ nullable: "YES" });
  });
});
