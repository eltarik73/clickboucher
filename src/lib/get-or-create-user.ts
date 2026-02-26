import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { isTestMode, TEST_USERS, type TestRole } from "@/lib/auth/test-auth";

/**
 * Find a user by Clerk ID, or auto-create them if the webhook hasn't fired yet.
 * Returns the Prisma user or null if Clerk user doesn't exist.
 */
export async function getOrCreateUser(clerkId: string) {
  // 1. Try to find in DB
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (user) return user;

  // @security: test-only — Auto-create test users without calling Clerk
  if (isTestMode() && clerkId.startsWith("test-")) {
    const testUser = Object.values(TEST_USERS).find((u) => u.clerkId === clerkId);
    if (testUser) {
      try {
        user = await prisma.user.create({
          data: {
            clerkId,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            role: testUser.role as "CLIENT" | "BOUCHER" | "ADMIN",
          },
        });
        console.log(`[getOrCreateUser] Auto-created TEST user for clerkId=${clerkId}`);
        return user;
      } catch {
        // May already exist (race condition) — try to find again
        return prisma.user.findUnique({ where: { clerkId } });
      }
    }
  }

  // 2. Not in DB — fetch from Clerk and create
  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(clerkId);

    user = await prisma.user.create({
      data: {
        clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        phone: clerkUser.phoneNumbers[0]?.phoneNumber || null,
        role: "CLIENT",
      },
    });

    console.log(`[getOrCreateUser] Auto-created user for clerkId=${clerkId}`);
    return user;
  } catch (error) {
    console.error(`[getOrCreateUser] Failed to auto-create user for clerkId=${clerkId}:`, error);
    return null;
  }
}
