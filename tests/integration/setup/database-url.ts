// URL de la base des tests d'intégration : même serveur et même base que DATABASE_URL, dans un
// schéma PostgreSQL à part. Le schéma `public` (recette locale, base de la CI) n'est jamais touché.
// Module pur : aucun accès réseau, aucune lecture de l'environnement.
import { localPostgresIssue, type LocalPostgresIssue } from "../../../src/lib/local-postgres-url";

export const INTEGRATION_SCHEMA = "itest";

function refusal(issue: LocalPostgresIssue): string {
  switch (issue.reason) {
    case "missing":
      return (
        "DATABASE_URL n'est pas définie : les tests d'intégration ont besoin d'un PostgreSQL local " +
        "(par exemple postgresql://ci:ci@127.0.0.1:55433/ci?schema=public)."
      );
    case "not-postgres":
      return "DATABASE_URL n'est pas une URL PostgreSQL (postgresql://utilisateur:motdepasse@hôte:port/base).";
    case "remote":
      return (
        "Les tests d'intégration exigent un serveur PostgreSQL local (localhost, 127.0.0.1 ou ::1) : " +
        `DATABASE_URL vise « ${issue.host === "" ? "aucun hôte" : issue.host} ». Ils vident des tables, ` +
        "ils ne s'exécutent jamais sur un serveur partagé ou distant."
      );
  }
}

/**
 * Same server and database as `baseUrl`, with `schema=itest`; every other URL parameter is kept.
 * Throws unless `baseUrl` targets a local PostgreSQL (src/lib/local-postgres-url.ts) — the suite
 * truncates tables, it must never reach a shared or remote server.
 * Error messages never contain the URL itself (it carries the password).
 */
export function integrationDatabaseUrl(baseUrl: string | undefined): string {
  const issue = localPostgresIssue(baseUrl);
  if (issue !== null) throw new Error(refusal(issue));

  // localPostgresIssue returned null: baseUrl is a defined, parsable PostgreSQL URL.
  const url = new URL(baseUrl!);
  url.searchParams.set("schema", INTEGRATION_SCHEMA);
  return url.toString();
}
