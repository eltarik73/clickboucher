// @security: test-only — Server-side auth wrapper with test mode bypass
// In test mode, reads role from cookie and returns mock userId
// In production, delegates to Clerk auth()

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { isTestMode, TEST_USERS, type TestRole } from "./test-auth";

/**
 * Drop-in replacement for `const { userId } = await auth()`
 * In test mode, returns the test user ID from the cookie.
 * In production, calls Clerk auth() normally.
 */
export async function getServerUserId(): Promise<string | null> {
  // @security: test-only
  if (isTestMode()) {
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
 * Returns null if not in test mode.
 */
export function getTestRole(): TestRole | null {
  if (!isTestMode()) return null;
  const cookieStore = cookies();
  return (cookieStore.get("klikgo-test-role")?.value || "CLIENT") as TestRole;
}
