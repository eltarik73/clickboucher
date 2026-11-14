// Accès base des tests d'intégration : le client Prisma de l'application (jamais un mock),
// connecté au schéma `itest` par tests/integration/setup/env.ts.
import { afterAll, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { INTEGRATION_SCHEMA } from "../setup/database-url";

export { default as prisma } from "@/lib/prisma";

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * TRUNCATE every table of the current schema RESTART IDENTITY CASCADE.
 * Throws unless current_schema() is "itest". The statement also names that schema explicitly,
 * so it cannot empty a table of another schema whatever the connection's search_path.
 */
export async function resetDatabase(): Promise<void> {
  const [connection] = await prisma.$queryRaw<Array<{ schema: string | null }>>`
    SELECT current_schema() AS "schema"
  `;
  if (connection.schema !== INTEGRATION_SCHEMA) {
    throw new Error(
      `resetDatabase refuse de vider le schéma « ${connection.schema ?? "aucun"} » : ` +
        `seul le schéma « ${INTEGRATION_SCHEMA} » des tests d'intégration peut l'être.`
    );
  }

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
  `;
  if (tables.length === 0) {
    throw new Error(
      `Le schéma « ${INTEGRATION_SCHEMA} » ne contient aucune table : ` +
        "le setup global (prisma db push) n'a pas été exécuté."
    );
  }

  const qualifiedTables = tables
    .map(({ tablename }) => `${quoteIdentifier(INTEGRATION_SCHEMA)}.${quoteIdentifier(tablename)}`)
    .join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`);
}

/** Call at the top of a test file: beforeEach(resetDatabase) and afterAll(prisma.$disconnect). */
export function useCleanDatabase(): void {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());
}
