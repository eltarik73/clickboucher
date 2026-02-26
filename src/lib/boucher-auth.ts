// src/lib/boucher-auth.ts — Boucher authentication helper
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api/errors";
import { isBoucher } from "@/lib/roles";
import { getTestRole, isTestActivated } from "@/lib/auth/server-auth";

// ── In-memory boucher cache (5 min TTL) ──────────────
const boucherCache = new Map<string, { shopId: string; userId: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Vérifie que l'utilisateur est un boucher authentifié avec une boutique.
 * Retourne { userId, shopId } ou { error: Response }.
 */
export async function getAuthenticatedBoucher(): Promise<
  | { userId: string; shopId: string; error?: undefined }
  | { error: Response; userId?: undefined; shopId?: undefined }
> {
  // @security: test-only — Bypass Clerk only if secret was validated
  if (isTestActivated()) {
    const testRole = getTestRole();
    if (testRole === "BOUCHER" || testRole === "ADMIN") {
      // Find the first shop in DB for test boucher
      const firstShop = await prisma.shop.findFirst({
        select: { id: true, ownerId: true },
        orderBy: { createdAt: "asc" },
      });
      if (!firstShop) {
        return { error: apiError("NOT_FOUND", "Aucune boutique trouvée (test mode)") };
      }
      return { userId: firstShop.ownerId, shopId: firstShop.id };
    }
    return { error: apiError("FORBIDDEN", "Accès réservé aux bouchers (test mode: rôle = " + testRole + ")") };
  }

  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return { error: apiError("UNAUTHORIZED", "Authentification requise") };
  }

  // Check cache
  const cached = boucherCache.get(clerkId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { userId: cached.userId, shopId: cached.shopId };
  }

  // Check Clerk metadata
  const user = await currentUser();
  const role = (user?.publicMetadata as Record<string, string>)?.role;

  if (!isBoucher(role)) {
    return { error: apiError("FORBIDDEN", "Accès réservé aux bouchers") };
  }

  // Find shop owned by this user
  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });

  if (!dbUser) {
    return { error: apiError("NOT_FOUND", "Utilisateur introuvable") };
  }

  if (dbUser.role !== "BOUCHER" && dbUser.role !== "ADMIN") {
    return { error: apiError("FORBIDDEN", "Accès réservé aux bouchers") };
  }

  // Search by user.id OR clerkId (seed stores clerkId as ownerId)
  const shop = await prisma.shop.findFirst({
    where: { OR: [{ ownerId: dbUser.id }, { ownerId: clerkId }] },
    select: { id: true },
  });

  if (!shop) {
    return { error: apiError("NOT_FOUND", "Aucune boutique trouvée") };
  }

  // Cache the result
  boucherCache.set(clerkId, { shopId: shop.id, userId: dbUser.id, ts: Date.now() });

  // Evict old entries
  if (boucherCache.size > 200) {
    const oldest = [...boucherCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) boucherCache.delete(oldest[i][0]);
  }

  return { userId: dbUser.id, shopId: shop.id };
}
