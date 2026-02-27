// src/lib/boucher-auth.ts — Boucher authentication helper
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { apiError } from "@/lib/api/errors";
import { isBoucher } from "@/lib/roles";
import { getTestRole, isTestActivated } from "@/lib/auth/server-auth";

const REDIS_TTL = 300; // 5 min

// ── In-memory fallback cache (if Redis unavailable) ──
const memCache = new Map<string, { shopId: string; userId: string; ts: number }>();
const MEM_TTL = 5 * 60 * 1000;

/**
 * Vérifie que l'utilisateur est un boucher authentifié avec une boutique.
 * Retourne { userId, shopId } ou { error: Response }.
 * Uses Redis cache (survives cold starts) with in-memory fallback.
 */
export async function getAuthenticatedBoucher(): Promise<
  | { userId: string; shopId: string; error?: undefined }
  | { error: Response; userId?: undefined; shopId?: undefined }
> {
  // @security: test-only — Bypass Clerk only if secret was validated
  if (isTestActivated()) {
    const testRole = getTestRole();
    if (testRole === "BOUCHER" || testRole === "ADMIN") {
      const firstShop = await prisma.shop.findFirst({
        select: { id: true, ownerId: true },
        orderBy: { createdAt: "asc" },
      });
      if (!firstShop) {
        return { error: apiError("NOT_FOUND", "Aucune boutique trouvée (test mode)") };
      }
      const ownerUser = await prisma.user.findFirst({
        where: { OR: [{ id: firstShop.ownerId }, { clerkId: firstShop.ownerId }] },
        select: { id: true },
      });
      return { userId: ownerUser?.id || firstShop.ownerId, shopId: firstShop.id };
    }
    return { error: apiError("FORBIDDEN", "Accès réservé aux bouchers (test mode: rôle = " + testRole + ")") };
  }

  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return { error: apiError("UNAUTHORIZED", "Authentification requise") };
  }

  // 1. Check Redis cache (survives cold starts)
  const cacheKey = `boucher:auth:${clerkId}`;
  const cached = await redis.get<{ shopId: string; userId: string }>(cacheKey);
  if (cached && cached.shopId && cached.userId) {
    return { userId: cached.userId, shopId: cached.shopId };
  }

  // 2. Fallback: check in-memory cache
  const memCached = memCache.get(clerkId);
  if (memCached && Date.now() - memCached.ts < MEM_TTL) {
    return { userId: memCached.userId, shopId: memCached.shopId };
  }

  // 3. DB lookup — parallel: user + shop
  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });

  if (!dbUser) {
    return { error: apiError("NOT_FOUND", "Utilisateur introuvable") };
  }

  if (!isBoucher(dbUser.role) && dbUser.role !== "ADMIN") {
    return { error: apiError("FORBIDDEN", "Accès réservé aux bouchers") };
  }

  const shop = await prisma.shop.findFirst({
    where: { OR: [{ ownerId: dbUser.id }, { ownerId: clerkId }] },
    select: { id: true },
  });

  if (!shop) {
    return { error: apiError("NOT_FOUND", "Aucune boutique trouvée") };
  }

  // Cache in Redis + memory
  const result = { shopId: shop.id, userId: dbUser.id };
  redis.set(cacheKey, result, { ex: REDIS_TTL }).catch(() => {});
  memCache.set(clerkId, { ...result, ts: Date.now() });

  // Evict old memory entries
  if (memCache.size > 200) {
    const oldest = [...memCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) memCache.delete(oldest[i][0]);
  }

  return result;
}
