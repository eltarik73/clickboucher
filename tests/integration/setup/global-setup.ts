// Setup global du projet Vitest `integration` : s'exécute une fois par lancement, dans le processus
// principal, avant le premier worker.
//   1. Refuse une DATABASE_URL absente ou qui ne vise pas un serveur local, avant toute connexion.
//   2. Prend le verrou du schéma `itest` : deux lancements simultanés sur la même base (plusieurs
//      terminaux, plusieurs worktrees) videraient les tables l'un de l'autre. Le second attend.
//   3. Aligne le schéma `itest` sur prisma/schema.prisma.
// Le verrou est rendu à la fin du lancement, ou dès que ce processus s'arrête.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import type { TestProject } from "vitest/node";
import { INTEGRATION_SCHEMA, integrationDatabaseUrl } from "./database-url";

/** Advisory lock (pg_advisory_xact_lock(hashtext(name))) held by a run from schema push to teardown. */
export const RUN_LOCK_NAME = `klikgo-integration-tests:${INTEGRATION_SCHEMA}`;

// Attente maximale d'un lancement concurrent, puis échec explicite.
const RUN_LOCK_WAIT = "10min";
// Durée maximale de la transaction qui porte le verrou : bien au-delà d'un lancement complet.
const RUN_LOCK_MAX_HOLD_MS = 2 * 60 * 60 * 1000;

const PRISMA_DB_PUSH = ["db", "push", "--skip-generate", "--accept-data-loss"] as const;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/**
 * Holds the run lock in an open transaction on a dedicated connection: PostgreSQL releases it when
 * the transaction ends or the connection drops, so a killed run can never leave it behind.
 * Resolves, once the lock is held, with the function that releases it.
 */
async function acquireRunLock(url: string): Promise<() => Promise<void>> {
  const client = new PrismaClient({ datasourceUrl: url });
  const lockHeld = deferred();
  const runFinished = deferred();

  const transaction = client.$transaction(
    async (tx) => {
      const [{ free }] = await tx.$queryRaw<Array<{ free: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${RUN_LOCK_NAME})) AS "free"
      `;
      if (!free) {
        console.warn(
          `[tests d'intégration] Le schéma ${INTEGRATION_SCHEMA} est utilisé par un autre lancement : ` +
            `attente de sa fin (${RUN_LOCK_WAIT} au plus)…`
        );
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${RUN_LOCK_WAIT}'`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${RUN_LOCK_NAME}))`;
      }
      lockHeld.resolve();
      await runFinished.promise;
    },
    { maxWait: 10_000, timeout: RUN_LOCK_MAX_HOLD_MS }
  );

  try {
    await Promise.race([lockHeld.promise, transaction]);
  } catch (error) {
    await client.$disconnect();
    throw new Error(
      `Impossible de prendre le verrou du schéma ${INTEGRATION_SCHEMA} (base injoignable, ou autre ` +
        `lancement des tests d'intégration toujours en cours après ${RUN_LOCK_WAIT}) : ` +
        (error instanceof Error ? error.message : String(error)),
      { cause: error }
    );
  }

  return async () => {
    runFinished.resolve();
    try {
      await transaction;
    } finally {
      await client.$disconnect();
    }
  };
}

/**
 * `prisma db push --skip-generate --accept-data-loss` on the schema `itest`, in a child process.
 * Runs the CLI installed in node_modules with the current Node binary: unlike `npx prisma`, this
 * can never fall back to another Prisma version from the npx cache or the registry.
 */
function pushSchema(root: string, url: string): void {
  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  const command = `prisma ${PRISMA_DB_PUSH.join(" ")}`;
  const result = spawnSync(process.execPath, [prismaCli, ...PRISMA_DB_PUSH], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
    encoding: "utf8",
    shell: false,
  });

  if (result.error) {
    throw new Error(`Impossible de lancer « ${command} » : ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `« ${command} » a échoué sur le schéma ${INTEGRATION_SCHEMA} ` +
        `(code ${result.status ?? `signal ${result.signal}`}) :\n${result.stderr.trim() || result.stdout.trim()}`
    );
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const url = integrationDatabaseUrl(process.env.DATABASE_URL);

  const releaseRunLock = await acquireRunLock(url);
  try {
    pushSchema(project.config.root, url);
  } catch (error) {
    await releaseRunLock();
    throw error;
  }
  return releaseRunLock;
}
