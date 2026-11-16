// src/lib/local-postgres-url.ts — the one rule for « this database URL is a local PostgreSQL »,
// checked before they write by the seed, the integration suite, the photo repair scripts and the
// photo e2e run; each of them words its own refusal. Pure: no environment read, no message.
// prisma/ and tests/integration/setup reach it by relative path: they use no @/ import.

export type LocalPostgresIssue =
  | { reason: "missing" }
  | { reason: "not-postgres" }
  | { reason: "remote"; host: string };

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * null when `databaseUrl` is a PostgreSQL URL whose host and every `host` parameter are localhost,
 * 127.0.0.1 or ::1. A remote issue names the first other host, lower case and without brackets
 * ('' for a URL without host); never the URL itself, which carries the password.
 */
export function localPostgresIssue(databaseUrl: string | undefined): LocalPostgresIssue | null {
  if (databaseUrl === undefined || databaseUrl.trim() === "") return { reason: "missing" };

  const url = URL.canParse(databaseUrl) ? new URL(databaseUrl) : null;
  if (url === null || !POSTGRES_PROTOCOLS.has(url.protocol)) return { reason: "not-postgres" };

  // The driver connects to the `host` parameter when there is one, else to the URL host.
  const host = [url.hostname, ...url.searchParams.getAll("host")]
    .map((candidate) => candidate.replace(/^\[(.*)\]$/, "$1").toLowerCase())
    .find((candidate) => !LOCAL_HOSTS.has(candidate));
  return host === undefined ? null : { reason: "remote", host };
}

export function isLocalPostgresUrl(databaseUrl: string | undefined): boolean {
  return localPostgresIssue(databaseUrl) === null;
}
