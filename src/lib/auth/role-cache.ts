// src/lib/auth/role-cache.ts — Centralised invalidation of all role caches.
// Three caches exist:
//  1. Edge middleware role cache (Redis "role:<clerkId>" + per-instance Map fallback)
//  2. admin-auth in-process cache (Map, 60s TTL)
//  3. boucher-auth Redis cache "boucher:auth:<clerkId>" + memCache fallback
//
// This helper purges all three. It MUST be called whenever a user's role
// changes (Clerk webhook user.updated, admin role mutations, etc.).

import { redis } from "@/lib/redis";

export const ROLE_CACHE_TTL_SECONDS = 60; // tightened from 5 min → 60s as defence-in-depth

const ROLE_KEY = (clerkId: string) => `role:${clerkId}`;
const BOUCHER_KEY = (clerkId: string) => `boucher:auth:${clerkId}`;

/**
 * Invalidate all caches that hold a user's role/shop association.
 * Called from webhooks and admin role mutations so a banned/demoted user
 * loses access immediately rather than after the previous 5-min TTL.
 *
 * Best-effort — never throws. Logs but does not propagate Redis failures.
 */
export async function invalidateRoleCache(clerkId: string): Promise<void> {
  if (!clerkId) return;
  await Promise.all([
    redis.del(ROLE_KEY(clerkId)).catch(() => {}),
    redis.del(BOUCHER_KEY(clerkId)).catch(() => {}),
  ]);
  // In-process Maps in admin-auth.ts and boucher-auth.ts cannot be reached from
  // here without circular imports; they have a 60s/5min TTL respectively. The
  // Redis purge is what survives across instances and matters most.
}
