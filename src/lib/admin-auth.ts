// src/lib/admin-auth.ts — Admin authentication helper
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";
import { TEST_USERS } from "@/lib/auth/test-auth";
import { getTestRole, isTestActivated } from "@/lib/auth/server-auth";

// ── In-memory admin role cache (5 min TTL) ──────────────
// Avoids calling currentUser() (HTTP ~100-300ms) on every admin API request
const adminCache = new Map<string, { isAdmin: boolean; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Vérifie que l'utilisateur est admin (via Clerk publicMetadata + DB role).
 * Résultat mis en cache 5 min pour éviter les appels HTTP Clerk répétés.
 */
export async function requireAdmin() {
  // @security: test-only — Bypass Clerk only if secret was validated
  if (isTestActivated()) {
    const testRole = getTestRole();
    if (testRole === "ADMIN") {
      return { userId: TEST_USERS.ADMIN.clerkId };
    }
    return { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs (test mode: rôle actuel = " + testRole + ")") };
  }

  const { userId } = await auth();

  if (!userId) {
    return { error: apiError("UNAUTHORIZED", "Authentification requise") };
  }

  // Check cache first
  const cached = adminCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (cached.isAdmin) return { userId };
    return { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };
  }

  // Read role directly from Clerk publicMetadata
  const user = await currentUser();
  const role = (user?.publicMetadata as Record<string, string>)?.role;
  if (isAdmin(role)) {
    adminCache.set(userId, { isAdmin: true, ts: Date.now() });
    evictOldEntries();
    return { userId };
  }

  // Fallback: check DB role
  const dbUser = await prisma.user.findFirst({
    where: { clerkId: userId, role: "ADMIN" },
    select: { id: true },
  });

  const result = !!dbUser;
  adminCache.set(userId, { isAdmin: result, ts: Date.now() });
  evictOldEntries();

  if (!result) {
    return { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };
  }

  return { userId };
}

function evictOldEntries() {
  if (adminCache.size > 200) {
    const oldest = [...adminCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) adminCache.delete(oldest[i][0]);
  }
}

/**
 * Verify that a shop exists and optionally belongs to a specific owner.
 * Used by admin/webmaster endpoints that operate on a specific shop.
 */
export async function assertShopAccess(shopId: string, ownerId?: string) {
  const where: Record<string, string> = { id: shopId };
  if (ownerId) where.ownerId = ownerId;

  const shop = await prisma.shop.findFirst({
    where,
    select: { id: true, name: true, ownerId: true },
  });

  if (!shop) {
    return { error: apiError("NOT_FOUND", "Boutique introuvable") };
  }

  return { shop };
}
