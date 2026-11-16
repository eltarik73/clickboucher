// Cible autorisée du seed (prisma/seed.ts vide les tables avant de les remplir). Module pur : aucun
// accès réseau, aucune lecture de l'environnement. La règle est celle de
// src/lib/local-postgres-url.ts (un PostgreSQL local, sans exception ni option de contournement) ;
// ce module n'écrit que les messages, qui ne contiennent jamais l'URL (elle porte le mot de passe).
import { localPostgresIssue } from "../src/lib/local-postgres-url";

/**
 * null quand `databaseUrl` vise un PostgreSQL local (localhost, 127.0.0.1 ou ::1, paramètre `host`
 * compris) ; sinon le message français à afficher avant de refuser.
 */
export function seedTargetIssue(databaseUrl: string | undefined): string | null {
  const issue = localPostgresIssue(databaseUrl);
  if (issue === null) return null;

  switch (issue.reason) {
    case "missing":
      return (
        "DATABASE_URL n'est pas définie : le seed ne s'exécute que sur un PostgreSQL local " +
        "(localhost, 127.0.0.1 ou ::1)."
      );
    case "not-postgres":
      return (
        "DATABASE_URL n'est pas une URL PostgreSQL (postgresql://utilisateur:motdepasse@hôte:port/base) : " +
        "le seed ne s'exécute que sur un PostgreSQL local."
      );
    case "remote":
      return (
        "Le seed vide les tables : il ne s'exécute que sur un PostgreSQL local (localhost, 127.0.0.1 ou ::1). " +
        `DATABASE_URL vise « ${issue.host === "" ? "aucun hôte" : issue.host} ».`
      );
  }
}
