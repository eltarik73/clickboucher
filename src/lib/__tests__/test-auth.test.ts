// @vitest-environment node
//
// Test-mode helpers (src/lib/auth/test-auth.ts). Mistakes here have a
// concrete security impact: a true return from isTestMode() in prod would
// let bypass-Clerk users hit privileged routes. We pin the conditions so
// any future edit that loosens the gate fails CI immediately.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isTestMode, testRoleToClerkRole, TEST_USERS } from "@/lib/auth/test-auth";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Reset before each test so cases are independent
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isTestMode", () => {
  it("should return false when TEST_MODE env var is not the literal 'true'", () => {
    delete process.env.TEST_MODE;
    expect(isTestMode()).toBe(false);
    process.env.TEST_MODE = "1"; // truthy but not "true"
    expect(isTestMode()).toBe(false);
  });

  it("should return true in dev/test when TEST_MODE='true'", () => {
    process.env.TEST_MODE = "true";
    vi.stubEnv("NODE_ENV", "development");
    expect(isTestMode()).toBe(true);
  });

  it("should refuse to enable on a production build unless ALLOW_TEST_IN_PROD is explicitly set", () => {
    // Build de production HORS prod Vercel (preview, `next start` local)
    process.env.TEST_MODE = "true";
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.VERCEL_ENV;
    delete process.env.KLIKGO_DEPLOY_ENV;
    delete process.env.ALLOW_TEST_IN_PROD;
    expect(isTestMode()).toBe(false);
    process.env.ALLOW_TEST_IN_PROD = "true";
    expect(isTestMode()).toBe(true);
  });

  it("should NEVER enable on the Vercel production deployment, whatever the flags", () => {
    // Faille du 2026-11-13 : TEST_MODE + ALLOW_TEST_IN_PROD étaient définis en
    // prod, et deux cookies en clair donnaient l'accès ADMIN à tout visiteur.
    process.env.TEST_MODE = "true";
    process.env.ALLOW_TEST_IN_PROD = "true";
    vi.stubEnv("NODE_ENV", "production");

    process.env.VERCEL_ENV = "production";
    delete process.env.KLIKGO_DEPLOY_ENV;
    expect(isTestMode()).toBe(false);

    // Même si la variable système n'était pas exposée au runtime, la valeur
    // figée au build suffit.
    delete process.env.VERCEL_ENV;
    process.env.KLIKGO_DEPLOY_ENV = "production";
    expect(isTestMode()).toBe(false);

    // Un déploiement de preview reste utilisable pour la recette.
    process.env.VERCEL_ENV = "preview";
    process.env.KLIKGO_DEPLOY_ENV = "preview";
    expect(isTestMode()).toBe(true);
  });
});

describe("testRoleToClerkRole", () => {
  it("should map every TestRole to its Clerk role string", () => {
    // Lowercase mapping is what /api/test-mode/activate uses to set cookies
    expect(testRoleToClerkRole("CLIENT")).toBe("client");
    expect(testRoleToClerkRole("BOUCHER")).toBe("boucher");
    expect(testRoleToClerkRole("ADMIN")).toBe("admin");
  });
});

describe("TEST_USERS catalog", () => {
  it("should expose the three roles with valid identifying fields", () => {
    // These objects power /api/test-mode/* — missing fields would crash auth
    for (const role of ["CLIENT", "BOUCHER", "ADMIN"] as const) {
      const user = TEST_USERS[role];
      expect(user.role).toBe(role);
      expect(user.id.length).toBeGreaterThan(0);
      expect(user.clerkId).toBe(user.id); // contract: same id used in both fields
      expect(user.email).toMatch(/@/);
    }
  });
});
