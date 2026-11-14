// Destination : tests/e2e/support/db.ts
// Accès direct à la base depuis le processus Playwright, pour préparer un état qu'aucune API ne sait
// produire. Même base que le serveur testé (DATABASE_URL de l'environnement, schéma public).
// Ne pas importer tests/integration/helpers/* ici : ces fichiers importent Vitest.
import prisma from "@/lib/prisma";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Refuse toute base qui n'est pas une base locale réservée aux tests : hôte local ET nom de base
 * "ci", "*_test" ou "*_e2e". La base de développement (docker-compose : "clickboucher") est refusée.
 * Le message ne contient jamais l'URL (elle porte le mot de passe).
 */
export function assertDisposableDatabase(rawUrl: string | undefined = process.env.DATABASE_URL): void {
  if (!rawUrl) throw new Error("DATABASE_URL absent : les parcours exigent une base de test explicite.");
  const url = new URL(rawUrl);
  const database = url.pathname.replace(/^\//, "");
  if (!LOCAL_HOSTS.has(url.hostname) || !/^(ci|.+_(test|e2e))$/.test(database)) {
    throw new Error(
      `Base refusée (${url.hostname}/${database}) : hôte local et base "ci", "*_test" ou "*_e2e" exigés. Rien n'a été écrit.`,
    );
  }
}

export { prisma };
