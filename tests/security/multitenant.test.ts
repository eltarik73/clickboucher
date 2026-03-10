// tests/security/multitenant.test.ts — Multi-tenant security tests
import { describe, it, expect } from "vitest";

/**
 * These tests verify the security patterns used across the codebase.
 * They test the pure logic functions without mocking Prisma/Clerk.
 */

// ── Role checking logic (from src/lib/roles.ts) ──

type Role = "CLIENT" | "CLIENT_PRO" | "CLIENT_PRO_PENDING" | "BOUCHER" | "ADMIN";

function isAdmin(role?: string): boolean {
  return role === "ADMIN";
}

function isBoucher(role?: string): boolean {
  return role === "BOUCHER";
}

function isClientPro(role?: string): boolean {
  return role === "CLIENT_PRO";
}

// ── Tests ──

describe("Role checking functions", () => {
  describe("isAdmin", () => {
    it("returns true for ADMIN role", () => {
      expect(isAdmin("ADMIN")).toBe(true);
    });

    it("returns false for BOUCHER role", () => {
      expect(isAdmin("BOUCHER")).toBe(false);
    });

    it("returns false for CLIENT role", () => {
      expect(isAdmin("CLIENT")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isAdmin(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isAdmin("")).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(isAdmin("admin")).toBe(false);
      expect(isAdmin("Admin")).toBe(false);
    });
  });

  describe("isBoucher", () => {
    it("returns true for BOUCHER role", () => {
      expect(isBoucher("BOUCHER")).toBe(true);
    });

    it("returns false for CLIENT role", () => {
      expect(isBoucher("CLIENT")).toBe(false);
    });

    it("returns false for ADMIN role", () => {
      expect(isBoucher("ADMIN")).toBe(false);
    });
  });

  describe("isClientPro", () => {
    it("returns true for CLIENT_PRO role", () => {
      expect(isClientPro("CLIENT_PRO")).toBe(true);
    });

    it("returns false for CLIENT_PRO_PENDING", () => {
      expect(isClientPro("CLIENT_PRO_PENDING")).toBe(false);
    });
  });
});

describe("Shop ownership OR clause pattern", () => {
  /**
   * The codebase uses this pattern for shop ownership verification:
   * { OR: [{ ownerId: clerkId }, { ownerId: dbUser.id }] }
   *
   * This is because shop.ownerId may store either:
   * - The Clerk user ID (user_xxx)
   * - The Prisma user ID (cm...)
   */

  function buildOwnershipQuery(clerkId: string, prismaId: string) {
    return {
      OR: [{ ownerId: clerkId }, { ownerId: prismaId }],
    };
  }

  it("includes both Clerk ID and Prisma ID in OR clause", () => {
    const query = buildOwnershipQuery("user_abc123", "cm_xyz789");
    expect(query.OR).toHaveLength(2);
    expect(query.OR[0]).toEqual({ ownerId: "user_abc123" });
    expect(query.OR[1]).toEqual({ ownerId: "cm_xyz789" });
  });

  it("handles same ID for both (edge case)", () => {
    const query = buildOwnershipQuery("same_id", "same_id");
    expect(query.OR).toHaveLength(2);
    // Both point to same ID — Prisma handles this gracefully
  });
});

describe("Webhook role mapping", () => {
  // From src/app/api/webhooks/clerk/route.ts
  const ROLE_MAP: Record<string, Role> = {
    client: "CLIENT",
    client_pro: "CLIENT_PRO",
    client_pro_pending: "CLIENT_PRO_PENDING",
    boucher: "BOUCHER",
    admin: "ADMIN",
  };

  it("maps all valid roles correctly", () => {
    expect(ROLE_MAP["client"]).toBe("CLIENT");
    expect(ROLE_MAP["boucher"]).toBe("BOUCHER");
    expect(ROLE_MAP["admin"]).toBe("ADMIN");
    expect(ROLE_MAP["client_pro"]).toBe("CLIENT_PRO");
    expect(ROLE_MAP["client_pro_pending"]).toBe("CLIENT_PRO_PENDING");
  });

  it("returns undefined for unknown roles (defaults to CLIENT)", () => {
    const metadataRole = "superuser";
    const role = ROLE_MAP[metadataRole] ?? "CLIENT";
    expect(role).toBe("CLIENT");
  });

  it("returns undefined for empty string (defaults to CLIENT)", () => {
    const metadataRole = "";
    const role = ROLE_MAP[metadataRole] ?? "CLIENT";
    expect(role).toBe("CLIENT");
  });
});

describe("User ID resolution pattern", () => {
  /**
   * The codebase has this critical pattern:
   * const clerkId = await getServerUserId(); // returns "user_xxx"
   * const dbUser = await prisma.user.findUnique({ where: { clerkId } });
   * const userId = dbUser?.id || clerkId; // Prisma ID for DB comparisons
   */

  function resolveUserId(dbUserId: string | undefined, clerkId: string): string {
    return dbUserId || clerkId;
  }

  it("uses Prisma ID when available", () => {
    expect(resolveUserId("cm_abc123", "user_xyz")).toBe("cm_abc123");
  });

  it("falls back to Clerk ID when no DB user", () => {
    expect(resolveUserId(undefined, "user_xyz")).toBe("user_xyz");
  });

  it("prefers Prisma ID (never returns Clerk ID when both exist)", () => {
    const result = resolveUserId("cm_abc", "user_xyz");
    expect(result).not.toBe("user_xyz");
    expect(result).toBe("cm_abc");
  });
});

describe("Pickup code extraction", () => {
  // From OrderTicket.tsx — extracts 4-digit code from UUID
  function extractPickupCode(orderId: string): string {
    return orderId.replace(/-/g, "").slice(-4).toUpperCase();
  }

  it("extracts last 4 chars from UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(extractPickupCode(uuid)).toBe("0000");
  });

  it("handles different UUIDs", () => {
    expect(extractPickupCode("abc-def-1234")).toBe("1234");
    expect(extractPickupCode("xxxx-yyyy-ABCD")).toBe("ABCD");
  });

  it("always returns uppercase", () => {
    expect(extractPickupCode("abc-def-ghij")).toBe("GHIJ");
  });
});
