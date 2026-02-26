// src/lib/feature-flags.ts — Platform-level feature flag helper
import prisma from "@/lib/prisma";

// ── In-memory cache (2 min TTL) ──
const flagCache = new Map<string, { enabled: boolean; ts: number }>();
const CACHE_TTL = 2 * 60 * 1000;

/**
 * Check if a platform feature flag is enabled.
 * Results cached in-memory for 2 minutes.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const cached = flagCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.enabled;
  }

  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });

  const enabled = flag?.enabled ?? false;
  flagCache.set(key, { enabled, ts: Date.now() });

  // Evict stale entries
  if (flagCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of flagCache) {
      if (now - v.ts > CACHE_TTL) flagCache.delete(k);
    }
  }

  return enabled;
}

/**
 * Invalidate a single flag from cache (after admin toggle).
 */
export function invalidateFlag(key: string) {
  flagCache.delete(key);
}

/**
 * Invalidate all flags from cache.
 */
export function invalidateAllFlags() {
  flagCache.clear();
}

// ── Platform config helper ──

const configCache = new Map<string, { value: string; ts: number }>();

/**
 * Get a platform config value by key.
 */
export async function getPlatformConfig(key: string): Promise<string | null> {
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.value;
  }

  const config = await prisma.platformConfig.findUnique({
    where: { key },
    select: { value: true },
  });

  if (config) {
    configCache.set(key, { value: config.value, ts: Date.now() });
  }

  return config?.value ?? null;
}

export function invalidateConfig(key: string) {
  configCache.delete(key);
}
