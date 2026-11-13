// @security: test-only — Server-side auth wrapper with test mode bypass
//
// Le contournement de Clerk n'est accordé que sur présentation du jeton de
// session de test SIGNÉ (cookie httpOnly posé par /api/test-mode/activate après
// vérification du secret), et jamais sur le déploiement de production Vercel.
// Les cookies en clair klikgo-test-activated / klikgo-test-role ne sont que des
// indices d'interface : ils ne donnent aucun droit.

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getTestSecret, isTestMode, TEST_USERS, type TestRole } from "./test-auth";
import { TEST_SESSION_COOKIE } from "./test-session";
import { verifyTestSessionSync } from "./test-session-node";

/**
 * Rôle de la session de test en cours, ou null s'il n'y en a pas de valide
 * (mode test désactivé, jeton absent, expiré ou mal signé).
 */
export function getTestRole(): TestRole | null {
  if (!isTestMode()) return null;
  const token = cookies().get(TEST_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyTestSessionSync(token, getTestSecret());
}

/** Une session de test valide est-elle présente ? */
export function isTestActivated(): boolean {
  return getTestRole() !== null;
}

/**
 * Drop-in replacement for `const { userId } = await auth()`
 * In test mode (valid signed session), returns the test user ID for the session role.
 * Otherwise, calls Clerk auth() normally.
 */
export async function getServerUserId(): Promise<string | null> {
  // @security: test-only — only bypass with a verified test session
  const testRole = getTestRole();
  if (testRole) {
    return TEST_USERS[testRole].clerkId;
  }

  const { userId } = await auth();
  return userId;
}

/**
 * Like getServerUserId(), but for boucher routes that check shop ownership.
 * In test mode with BOUCHER role, returns the shop's actual ownerId
 * so that `order.shop.ownerId !== userId` checks pass correctly.
 * Outside test mode, behaves identically to getServerUserId().
 */
export async function getBoucherOwnerUserId(): Promise<string | null> {
  const testRole = getTestRole();
  if (testRole) {
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
    return TEST_USERS[testRole].clerkId;
  }

  const { userId } = await auth();
  return userId;
}

/**
 * Resolve the user's role for permission checks.
 * Audit sécurité 2026-05-09 : remplace l'ancien pattern
 *   `currentUser().publicMetadata.role` qui peut être stale si webhook
 *   Clerk a échoué. La DB est la source de vérité pour les rôles.
 *
 * Returns the role string ("ADMIN", "BOUCHER", "CLIENT", etc.) or undefined.
 * En mode test, retourne le role testé (ADMIN ⇒ "admin" pour isAdmin).
 */
export async function resolveUserRole(): Promise<string | undefined> {
  const testRole = getTestRole();
  if (testRole) {
    return testRole === "ADMIN" ? "admin" : undefined;
  }

  const userId = await getServerUserId();
  if (!userId) return undefined;

  // Lazy import to avoid circular dependency
  const { default: prisma } = await import("@/lib/prisma");
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });
  return dbUser?.role;
}
