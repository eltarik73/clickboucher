// @security: test-only — Server-side auth wrapper with test mode bypass
// In test mode, checks klikgo-test-activated cookie before bypassing
// Without the activated cookie, falls through to normal Clerk auth

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { isTestMode, TEST_USERS, type TestRole } from "./test-auth";

/** Check if test mode is actually activated (secret was validated) */
function isTestActivated(): boolean {
  if (!isTestMode()) return false;
  const cookieStore = cookies();
  return cookieStore.get("klikgo-test-activated")?.value === "true";
}

/**
 * Drop-in replacement for `const { userId } = await auth()`
 * In test mode (activated), returns the test user ID from the cookie.
 * Otherwise, calls Clerk auth() normally.
 */
export async function getServerUserId(): Promise<string | null> {
  // @security: test-only — only bypass if secret was validated
  if (isTestActivated()) {
    const cookieStore = cookies();
    const testRole = (cookieStore.get("klikgo-test-role")?.value || "CLIENT") as TestRole;
    const user = TEST_USERS[testRole];
    return user?.clerkId || null;
  }

  const { userId } = await auth();
  return userId;
}

/**
 * Get the test role from cookie (server-side).
 * Returns null if test mode is not activated.
 */
export function getTestRole(): TestRole | null {
  if (!isTestActivated()) return null;
  const cookieStore = cookies();
  return (cookieStore.get("klikgo-test-role")?.value || "CLIENT") as TestRole;
}

/**
 * Like getServerUserId(), but for boucher routes that check shop ownership.
 * In test mode with BOUCHER role, returns the shop's actual ownerId
 * so that `order.shop.ownerId !== userId` checks pass correctly.
 * Outside test mode, behaves identically to getServerUserId().
 */
export async function getBoucherOwnerUserId(): Promise<string | null> {
  if (isTestActivated()) {
    const cookieStore = cookies();
    const testRole = (cookieStore.get("klikgo-test-role")?.value || "CLIENT") as TestRole;
    if (testRole === "BOUCHER" || testRole === "ADMIN") {
      // Lazy import to avoid circular dependency
      const { default: prisma } = await import("@/lib/prisma");
      const firstShop = await prisma.shop.findFirst({
        select: { ownerId: true },
        orderBy: { createdAt: "asc" },
      });
      return firstShop?.ownerId || null;
    }
    // Non-boucher test role: return the regular test user ID
    const user = TEST_USERS[testRole];
    return user?.clerkId || null;
  }

  const { userId } = await auth();
  return userId;
}

/** Expose isTestActivated for admin-auth and boucher-auth */
export { isTestActivated };
