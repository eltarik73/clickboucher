// Cible autorisée du seed (prisma/seed.ts vide les tables avant de les remplir). Module pur : aucun
// accès réseau, aucune lecture de l'environnement. Même règle que les tests d'intégration
// (tests/integration/setup/database-url.ts) : un PostgreSQL local, sans exception ni option de
// contournement. Les messages ne contiennent jamais l'URL (elle porte le mot de passe).

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHost(host: string): string {
  return host.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

/**
 * null quand `databaseUrl` vise un PostgreSQL local (localhost, 127.0.0.1 ou ::1) ; sinon le message
 * français à afficher avant de refuser. Le pilote se connecte au paramètre `host` quand il est
 * présent, sinon à l'hôte de l'URL : les deux doivent être locaux.
 */
export function seedTargetIssue(databaseUrl: string | undefined): string | null {
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    return (
      "DATABASE_URL n'est pas définie : le seed ne s'exécute que sur un PostgreSQL local " +
      "(localhost, 127.0.0.1 ou ::1)."
    );
  }

  const url = URL.canParse(databaseUrl) ? new URL(databaseUrl) : null;
  if (url === null || !POSTGRES_PROTOCOLS.has(url.protocol)) {
    return (
      "DATABASE_URL n'est pas une URL PostgreSQL (postgresql://utilisateur:motdepasse@hôte:port/base) : " +
      "le seed ne s'exécute que sur un PostgreSQL local."
    );
  }

  const hosts = [url.hostname, ...url.searchParams.getAll("host")].map(normalizeHost);
  const remoteHost = hosts.find((host) => !LOCAL_HOSTS.has(host));
  if (remoteHost === undefined) return null;

  return (
    "Le seed vide les tables : il ne s'exécute que sur un PostgreSQL local (localhost, 127.0.0.1 ou ::1). " +
    `DATABASE_URL vise « ${remoteHost === "" ? "aucun hôte" : remoteHost} ».`
  );
}
