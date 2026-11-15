// @vitest-environment node
// prisma/seed.ts commence par vider 26 tables : il ne doit viser qu'un PostgreSQL local. La règle
// est celle de tests/integration/setup/database-url.ts : l'hôte de l'URL ET chaque paramètre `host`
// (le pilote s'y connecte quand il est présent) doivent être localhost, 127.0.0.1 ou ::1.
// Régression attrapée : un DATABASE_URL de production dans l'environnement vide la base réelle.
import { describe, expect, it } from "vitest";
import { seedTargetIssue } from "../../../../prisma/seed-guard";

const PASSWORD = "S3cr3t-Pa55w0rd";
const USER = "klikgo_owner";

describe("seedTargetIssue — cibles acceptées", () => {
  it.each([
    "postgresql://ci:ci@127.0.0.1:55433/ci?schema=public",
    "postgres://u:p@localhost/db",
    "postgresql://u:p@[::1]:5432/db",
    "postgresql://u:p@LOCALHOST:5432/db",
    "postgresql://u:p@localhost:5432/db?host=127.0.0.1",
  ])("accepte %s", (url) => {
    expect(seedTargetIssue(url)).toBeNull();
  });
});

describe("seedTargetIssue — cibles refusées", () => {
  it("refuse un hôte Railway et nomme l'hôte", () => {
    const issue = seedTargetIssue(
      `postgresql://${USER}:${PASSWORD}@switchyard.proxy.rlwy.net:41234/railway?schema=public`
    );
    expect(issue).toEqual(expect.stringContaining("Le seed vide les tables"));
    expect(issue).toEqual(
      expect.stringContaining("DATABASE_URL vise « switchyard.proxy.rlwy.net »")
    );
  });

  it("refuse une URL locale dont le paramètre host vise un serveur distant", () => {
    const issue = seedTargetIssue(
      `postgresql://${USER}:${PASSWORD}@localhost:5432/app?host=remote.example`
    );
    expect(issue).toEqual(expect.stringContaining("DATABASE_URL vise « remote.example »"));
  });

  it("refuse une URL sans hôte (identifiants passés en paramètres)", () => {
    const issue = seedTargetIssue(`postgresql:///app?user=${USER}&password=${PASSWORD}`);
    expect(issue).toEqual(expect.stringContaining("DATABASE_URL vise « aucun hôte »"));
  });

  it.each([
    ["absente", undefined],
    ["vide", ""],
    ["blanche", "   "],
  ])("refuse une variable %s", (_label, url) => {
    expect(seedTargetIssue(url)).toEqual(expect.stringContaining("DATABASE_URL n'est pas définie"));
  });

  it.each([
    ["MySQL", `mysql://${USER}:${PASSWORD}@localhost:3306/app`],
    ["texte libre", "pas une url"],
  ])("refuse une URL qui n'est pas PostgreSQL (%s)", (_label, url) => {
    expect(seedTargetIssue(url)).toEqual(
      expect.stringContaining("DATABASE_URL n'est pas une URL PostgreSQL")
    );
  });

  it.each([
    `postgresql://${USER}:${PASSWORD}@switchyard.proxy.rlwy.net:41234/railway`,
    `postgresql://${USER}:${PASSWORD}@localhost:5432/app?host=remote.example`,
    `postgresql:///app?user=${USER}&password=${PASSWORD}`,
    `mysql://${USER}:${PASSWORD}@localhost:3306/app`,
  ])("ne recopie ni l'URL, ni l'utilisateur, ni le mot de passe : %s", (url) => {
    const issue = seedTargetIssue(url);
    expect(issue).toEqual(expect.any(String));
    expect(issue).not.toContain(PASSWORD);
    expect(issue).not.toContain(USER);
    expect(issue).not.toContain(url);
  });
});
