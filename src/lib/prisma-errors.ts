// src/lib/prisma-errors.ts — lecture typée des erreurs du client Prisma.
import { Prisma } from "@prisma/client";

/**
 * Columns of the unique constraint a Prisma write violated (error P2002), else null.
 *
 * On PostgreSQL, Prisma 6.19 reports `meta.target` as the list of the constraint's DATABASE column
 * names, not the schema.prisma field names: ["idempotency_key"] for a duplicate
 * orders.idempotency_key (asserted in tests/integration/orders/numbering.test.ts). Some connectors
 * report the constraint name as a single string: it is returned as a one-element list.
 *
 * A unique violation raised by `$executeRaw` / `$queryRaw` is not a P2002 (Prisma wraps it in
 * P2010) and returns null.
 */
export function uniqueViolationFields(error: unknown): string[] | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return null;
  }
  const target = error.meta?.target;
  if (typeof target === "string") return [target];
  if (Array.isArray(target) && target.every((field) => typeof field === "string")) {
    return target as string[];
  }
  throw new TypeError(
    `Unique violation P2002 without a readable meta.target: ${JSON.stringify(error.meta ?? null)}`,
    { cause: error }
  );
}
