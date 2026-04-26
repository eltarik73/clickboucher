// @security: test-only — Mode test : simule l'authentification sans Clerk
// Sécurisé par secret URL — s'active UNIQUEMENT via /api/test-mode/activate
// Le secret est dans TEST_SECRET (server-only — JAMAIS NEXT_PUBLIC_*)

export type TestRole = "CLIENT" | "BOUCHER" | "ADMIN";

export const TEST_USERS = {
  CLIENT: {
    id: "test-client-001",
    clerkId: "test-client-001",
    email: "client@test.klikgo",
    firstName: "Amina",
    lastName: "Test",
    role: "CLIENT" as const,
    shopId: null as string | null,
  },
  BOUCHER: {
    id: "test-boucher-001",
    clerkId: "test-boucher-001",
    email: "boucher@test.klikgo",
    firstName: "Mehdi",
    lastName: "Test",
    role: "BOUCHER" as const,
    shopId: null as string | null,
  },
  ADMIN: {
    id: "test-admin-001",
    clerkId: "test-admin-001",
    email: "admin@test.klikgo",
    firstName: "Tarik",
    lastName: "Test",
    role: "ADMIN" as const,
    shopId: null as string | null,
  },
};

/**
 * Server-only check: is test mode enabled at all?
 * Disabled in production unless ALLOW_TEST_IN_PROD="true" (escape hatch).
 */
export function isTestMode(): boolean {
  if (process.env.TEST_MODE !== "true") return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_IN_PROD !== "true") {
    return false;
  }
  return true;
}

/** Server-only — returns the test secret (no NEXT_PUBLIC_ exposure). */
export function getTestSecret(): string {
  return process.env.TEST_SECRET || "";
}

/** Get the Clerk-style role string from a test role */
export function testRoleToClerkRole(role: TestRole): string {
  const map: Record<TestRole, string> = {
    CLIENT: "client",
    BOUCHER: "boucher",
    ADMIN: "admin",
  };
  return map[role];
}
