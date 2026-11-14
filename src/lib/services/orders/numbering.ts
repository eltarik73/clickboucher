// src/lib/services/orders/numbering.ts — the three numbers of an order, allocated by the database.
//
// Every function runs on the caller's transaction (the order-creation transaction): a number is
// taken by an atomic insert-or-increment on a counter row, which also locks that row until the
// transaction ends (READ COMMITTED, Prisma's default for PostgreSQL). If the order is not created, the increment rolls back with it and the number is
// handed out again; concurrent orders queue on the row instead of reading the same maximum.
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { formatDisplayNumber, formatOrderNumber } from "@/lib/order-number-format";
import { getParisWallClock } from "@/lib/paris-time";

type Tx = Prisma.TransactionClient;

function singleNumber(rows: Array<{ value: number }>, what: string): number {
  if (rows.length !== 1) {
    throw new Error(`${what}: expected one counter row, got ${rows.length}`);
  }
  return rows[0].value;
}

/** Next order number of the Paris year of `now`: "KG26-000166". */
export async function allocateOrderNumber(tx: Tx, now: Date): Promise<string> {
  const { year } = getParisWallClock(now);
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "order_number_counters" ("year", "last_number")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
      SET "last_number" = "order_number_counters"."last_number" + 1
    RETURNING "last_number" AS "value"
  `;
  return formatOrderNumber(year, singleNumber(rows, "allocateOrderNumber"));
}

/** Next ticket number of the shop for the Paris date of `now`: 12 and "#012". */
export async function allocateDailyNumber(
  tx: Tx,
  shopId: string,
  now: Date
): Promise<{ dailyNumber: number; displayNumber: string }> {
  const { dateKey } = getParisWallClock(now);
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "daily_counters" ("id", "shop_id", "date", "last_number")
    VALUES (${randomUUID()}, ${shopId}, ${dateKey}::date, 1)
    ON CONFLICT ("shop_id", "date") DO UPDATE
      SET "last_number" = "daily_counters"."last_number" + 1
    RETURNING "last_number" AS "value"
  `;
  const dailyNumber = singleNumber(rows, "allocateDailyNumber");
  return { dailyNumber, displayNumber: formatDisplayNumber(dailyNumber) };
}

async function existingCustomerNumber(
  tx: Tx,
  shopId: string,
  userId: string
): Promise<number | null> {
  const row = await tx.shopCustomer.findUnique({
    where: { shopId_userId: { shopId, userId } },
    select: { number: true },
  });
  return row?.number ?? null;
}

/**
 * Number of the customer in the shop: the existing one, else a new one from the shop's counter.
 * Never throws on a concurrent first order of the same customer: the counter row lock serialises
 * the two transactions, the second one's insert finds the first one's committed row (ON CONFLICT
 * DO NOTHING) and returns that number. The number the loser took from the counter stays a gap.
 */
export async function allocateCustomerNumber(
  tx: Tx,
  shopId: string,
  userId: string
): Promise<number> {
  const existing = await existingCustomerNumber(tx, shopId, userId);
  if (existing !== null) return existing;

  const counterRows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "customer_counters" ("id", "shop_id", "last_number")
    VALUES (${randomUUID()}, ${shopId}, 1)
    ON CONFLICT ("shop_id") DO UPDATE
      SET "last_number" = "customer_counters"."last_number" + 1
    RETURNING "last_number" AS "value"
  `;
  const candidate = singleNumber(counterRows, "allocateCustomerNumber");

  const inserted = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "shop_customers" ("shop_id", "user_id", "number")
    VALUES (${shopId}, ${userId}, ${candidate})
    ON CONFLICT ("shop_id", "user_id") DO NOTHING
    RETURNING "number" AS "value"
  `;
  if (inserted.length === 1) return inserted[0].value;

  const winner = await existingCustomerNumber(tx, shopId, userId);
  if (winner === null) {
    throw new Error(
      `allocateCustomerNumber: shop_customers (${shopId}, ${userId}) conflicted but cannot be read`
    );
  }
  return winner;
}
