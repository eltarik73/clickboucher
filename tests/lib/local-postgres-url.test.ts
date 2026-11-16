// @vitest-environment node
// localPostgresIssue (src/lib/local-postgres-url.ts): the one rule for « this database is a local
// PostgreSQL », required before the seed, the integration suite, the photo repair scripts and the
// photo e2e run write. The driver connects to the `host` parameter when there is one, so every host
// parameter must be local as well as the URL host.
import { describe, expect, it } from "vitest";
import { isLocalPostgresUrl, localPostgresIssue } from "@/lib/local-postgres-url";
import { e2eTarget } from "../e2e/photos-helpers";

describe("localPostgresIssue — local targets", () => {
  it.each([
    "postgresql://ci:ci@127.0.0.1:55433/ci_photos_kit",
    "postgres://u@localhost/db",
    "postgresql://u@[::1]:5432/db",
    "postgresql://u:p@LOCALHOST:5432/db",
    "postgresql://u:p@localhost:5432/db?host=127.0.0.1",
  ])("%s is local", (url) => {
    expect(localPostgresIssue(url)).toBeNull();
    expect(isLocalPostgresUrl(url)).toBe(true);
  });
});

describe("localPostgresIssue — refused targets", () => {
  it.each([
    [
      "a Railway host",
      "postgresql://u@switchyard.proxy.rlwy.net:5432/railway",
      "switchyard.proxy.rlwy.net",
    ],
    [
      "a local URL whose host parameter is remote",
      "postgresql://u:p@localhost/db?host=db.remote.example",
      "db.remote.example",
    ],
    [
      "a name that starts with localhost",
      "postgresql://u@LocalHost.example.com/db",
      "localhost.example.com",
    ],
    ["a URL without host", "postgresql:///db?user=u", ""],
  ])("%s is remote", (_label, url, host) => {
    expect(localPostgresIssue(url)).toEqual({ reason: "remote", host });
    expect(isLocalPostgresUrl(url)).toBe(false);
  });

  it.each(["mysql://u@localhost:3306/db", "pas une url"])("%s is not PostgreSQL", (url) => {
    expect(localPostgresIssue(url)).toEqual({ reason: "not-postgres" });
    expect(isLocalPostgresUrl(url)).toBe(false);
  });

  it.each([undefined, "", "   "])("%j is missing", (url) => {
    expect(localPostgresIssue(url)).toEqual({ reason: "missing" });
    expect(isLocalPostgresUrl(url)).toBe(false);
  });
});

describe("callers refuse what the rule refuses", () => {
  it("the photo e2e run refuses a local URL whose host parameter is remote", () => {
    const env = {
      NODE_ENV: "test",
      E2E_TEST_SECRET: "local-secret",
      PLAYWRIGHT_BASE_URL: "http://localhost:3260",
      DATABASE_URL: "postgresql://u:p@localhost/db?host=db.remote.example",
    } as const;

    expect(() => e2eTarget(env)).toThrow("hôte « db.remote.example »");
  });
});
