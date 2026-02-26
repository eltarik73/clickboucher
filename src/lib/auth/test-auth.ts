// @security: test-only — Mode test : simule l'authentification sans Clerk
// JAMAIS en production — contrôlé par NEXT_PUBLIC_TEST_MODE

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
    shopId: null as string | null, // sera rempli avec le premier shop
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

export function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true";
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
