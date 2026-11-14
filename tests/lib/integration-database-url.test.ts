// @vitest-environment node
import { describe, expect, it } from "vitest";
import { INTEGRATION_SCHEMA, integrationDatabaseUrl } from "../integration/setup/database-url";

const LOCAL_URL = "postgresql://ci:ci@127.0.0.1:55433/ci?schema=public";

describe("integrationDatabaseUrl", () => {
  it("vise le schéma itest", () => {
    expect(INTEGRATION_SCHEMA).toBe("itest");
  });

  it("remplace le schéma en gardant serveur, base et identifiants", () => {
    expect(integrationDatabaseUrl(LOCAL_URL)).toBe(
      "postgresql://ci:ci@127.0.0.1:55433/ci?schema=itest"
    );
  });

  it("ajoute le schéma quand l'URL n'en précise pas", () => {
    expect(integrationDatabaseUrl("postgresql://ci:ci@localhost:5432/ci")).toBe(
      "postgresql://ci:ci@localhost:5432/ci?schema=itest"
    );
  });

  it("conserve les autres paramètres de l'URL", () => {
    const result = new URL(
      integrationDatabaseUrl(
        "postgresql://ci:ci@localhost:5432/ci?schema=public&connection_limit=1&pgbouncer=true"
      )
    );

    expect(result.searchParams.get("schema")).toBe("itest");
    expect(result.searchParams.get("connection_limit")).toBe("1");
    expect(result.searchParams.get("pgbouncer")).toBe("true");
    expect([...result.searchParams.keys()].sort()).toEqual([
      "connection_limit",
      "pgbouncer",
      "schema",
    ]);
  });

  it("ne garde qu'un seul paramètre schema", () => {
    const result = new URL(
      integrationDatabaseUrl("postgresql://ci:ci@localhost:5432/ci?schema=public&schema=autre")
    );

    expect(result.searchParams.getAll("schema")).toEqual(["itest"]);
  });

  it("est idempotente", () => {
    const once = integrationDatabaseUrl(LOCAL_URL);

    expect(integrationDatabaseUrl(once)).toBe(once);
  });

  it.each([
    ["localhost", "postgresql://ci:ci@localhost:5432/ci?schema=public"],
    ["LOCALHOST", "postgresql://ci:ci@LOCALHOST:5432/ci?schema=public"],
    ["127.0.0.1", "postgresql://ci:ci@127.0.0.1:5432/ci?schema=public"],
    ["::1", "postgresql://ci:ci@[::1]:5432/ci?schema=public"],
    ["le schéma postgres://", "postgres://ci:ci@localhost:5432/ci?schema=public"],
  ])("accepte un serveur local (%s)", (_label, url) => {
    expect(new URL(integrationDatabaseUrl(url)).searchParams.get("schema")).toBe("itest");
  });

  it.each([
    ["un hôte distant", "postgresql://app:s3cret-pw@switchyard.proxy.rlwy.net:5432/railway"],
    [
      "un nom qui commence par localhost",
      "postgresql://app:s3cret-pw@localhost.example.com:5432/ci",
    ],
    [
      "un nom qui commence par 127.0.0.1",
      "postgresql://app:s3cret-pw@127.0.0.1.example.com:5432/ci",
    ],
    ["une autre adresse du réseau", "postgresql://app:s3cret-pw@192.168.1.20:5432/ci"],
    ["une URL sans hôte", "postgresql:///ci"],
    [
      "un paramètre host qui détourne la connexion",
      "postgresql://app:s3cret-pw@localhost:5432/ci?host=db.example.com",
    ],
  ])("refuse %s", (_label, url) => {
    expect(() => integrationDatabaseUrl(url)).toThrow(/serveur PostgreSQL local/);
  });

  it("n'écrit jamais le mot de passe dans le message de refus", () => {
    let message = "";
    try {
      integrationDatabaseUrl("postgresql://app:s3cret-pw@switchyard.proxy.rlwy.net:5432/railway");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("switchyard.proxy.rlwy.net");
    expect(message).not.toContain("s3cret-pw");
  });

  it.each([
    ["absente", undefined],
    ["vide", ""],
    ["faite d'espaces", "   "],
  ])("refuse une URL %s", (_label, url) => {
    expect(() => integrationDatabaseUrl(url)).toThrow(/DATABASE_URL n'est pas définie/);
  });

  it("refuse une URL illisible sans la recopier", () => {
    let message = "";
    try {
      integrationDatabaseUrl("ci:s3cret-pw@localhost/ci sans schéma d'URL");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/DATABASE_URL n'est pas une URL PostgreSQL/);
    expect(message).not.toContain("s3cret-pw");
  });

  it("refuse une base qui n'est pas PostgreSQL", () => {
    expect(() => integrationDatabaseUrl("mysql://ci:ci@localhost:3306/ci")).toThrow(
      /DATABASE_URL n'est pas une URL PostgreSQL/
    );
  });
});
