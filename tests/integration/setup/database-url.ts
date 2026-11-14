// URL de la base des tests d'intégration : même serveur et même base que DATABASE_URL, dans un
// schéma PostgreSQL à part. Le schéma `public` (recette locale, base de la CI) n'est jamais touché.
// Module pur : aucun accès réseau, aucune lecture de l'environnement.

export const INTEGRATION_SCHEMA = "itest";

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHost(host: string): string {
  return host.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

/**
 * Same server and database as `baseUrl`, with `schema=itest`; every other URL parameter is kept.
 * Throws when `baseUrl` is missing, is not a PostgreSQL URL, or does not target localhost,
 * 127.0.0.1 or ::1 — the suite truncates tables, it must never reach a shared or remote server.
 * Error messages never contain the URL itself (it carries the password).
 */
export function integrationDatabaseUrl(baseUrl: string | undefined): string {
  if (baseUrl === undefined || baseUrl.trim() === "") {
    throw new Error(
      "DATABASE_URL n'est pas définie : les tests d'intégration ont besoin d'un PostgreSQL local " +
        "(par exemple postgresql://ci:ci@127.0.0.1:55433/ci?schema=public)."
    );
  }

  const url = URL.canParse(baseUrl) ? new URL(baseUrl) : null;
  if (url === null || !POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      "DATABASE_URL n'est pas une URL PostgreSQL (postgresql://utilisateur:motdepasse@hôte:port/base)."
    );
  }

  // Le pilote se connecte au paramètre `host` quand il est présent, sinon à l'hôte de l'URL :
  // les deux doivent être locaux.
  const hosts = [url.hostname, ...url.searchParams.getAll("host")].map(normalizeHost);
  const remoteHost = hosts.find((host) => !LOCAL_HOSTS.has(host));
  if (remoteHost !== undefined) {
    throw new Error(
      "Les tests d'intégration exigent un serveur PostgreSQL local (localhost, 127.0.0.1 ou ::1) : " +
        `DATABASE_URL vise « ${remoteHost === "" ? "aucun hôte" : remoteHost} ». Ils vident des tables, ` +
        "ils ne s'exécutent jamais sur un serveur partagé ou distant."
    );
  }

  url.searchParams.set("schema", INTEGRATION_SCHEMA);
  return url.toString();
}
