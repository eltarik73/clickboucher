// @vitest-environment node
//
// Clerk → Klik&Go role mapper. Critical: a wrong mapping promotes a CLIENT
// to BUTCHER (or vice versa) and unlocks privileged routes. Lock the
// expected mapping so any future regression is caught before it ships.

import { describe, it, expect } from "vitest";
import { roleFromClerk } from "@/lib/auth/rbac";

describe("roleFromClerk", () => {
  it("should default to CLIENT when no orgRole is provided", () => {
    // Visitors with no Clerk Org membership are plain clients
    expect(roleFromClerk(undefined)).toBe("CLIENT");
    expect(roleFromClerk(null)).toBe("CLIENT");
    expect(roleFromClerk("")).toBe("CLIENT");
  });

  it("should map 'org:admin' to WEBMASTER", () => {
    expect(roleFromClerk("org:admin")).toBe("WEBMASTER");
  });

  it("should map both manager-style roles to BUTCHER", () => {
    // The Clerk Org currently has two synonyms — both must resolve to BUTCHER
    expect(roleFromClerk("org:manager")).toBe("BUTCHER");
    expect(roleFromClerk("org:admin_butcher")).toBe("BUTCHER");
  });

  it("should fall back to CLIENT for any unknown role string (safe default)", () => {
    // Defense in depth: never silently grant elevated rights to a typo
    expect(roleFromClerk("org:something_new")).toBe("CLIENT");
  });
});
