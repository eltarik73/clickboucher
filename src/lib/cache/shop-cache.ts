// Cache Redis de la boutique lue par /boutique/[slug]. Seul ce module écrit sous la clé
// `shop:v<version>:<slug>` : une entrée est une enveloppe { v, shop } dont chaque Date et chaque
// BigInt sont étiquetés ({ $date: iso }, { $bigint: chiffres }) et reviennent avec leur type,
// quelle que soit la colonne. Le type rendu à la lecture est celui de la requête de l'appelant :
// changer la forme de cette requête (include, select) impose d'incrémenter SHOP_CACHE_VERSION,
// sinon une entrée écrite par la version précédente du code serait lue avec le nouveau type
// pendant SHOP_CACHE_TTL_SECONDS. Les erreurs de connexion sont absorbées par le client de
// src/lib/redis.ts, qui rend null.
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const SHOP_CACHE_VERSION = 2;

export const SHOP_CACHE_TTL_SECONDS = 60;

export interface CacheableShop {
  id: string;
  slug: string;
  products: ReadonlyArray<{ id: string }>;
}

export function shopCacheKey(slug: string): string {
  return `shop:v${SHOP_CACHE_VERSION}:${slug}`;
}

const INTEGER_DIGITS = /^-?\d+$/;

// Marque une valeur étiquetée illisible : l'entrée entière devient un défaut de cache.
const UNREADABLE = Symbol("unreadable");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON de { v, shop } : chaque Date devient { $date: iso }, chaque BigInt { $bigint: chiffres }. */
export function encodeCachedShop(shop: CacheableShop): string {
  // JSON.stringify applique Date.prototype.toJSON (et le BigInt.prototype.toJSON installé par
  // src/lib/api/errors.ts) avant d'appeler le replacer : la valeur d'origine se lit sur this[key].
  return JSON.stringify(
    { v: SHOP_CACHE_VERSION, shop },
    function (this: Record<string, unknown>, key: string, value: unknown): unknown {
      const original = this[key];
      if (original instanceof Date) return { $date: original.toISOString() };
      if (typeof original === "bigint") return { $bigint: original.toString() };
      return value;
    }
  );
}

function reviveTagged(tag: string, payload: unknown): Date | bigint | typeof UNREADABLE {
  if (typeof payload !== "string") return UNREADABLE;
  if (tag === "$date") {
    const date = new Date(payload);
    return Number.isNaN(date.getTime()) ? UNREADABLE : date;
  }
  return INTEGER_DIGITS.test(payload) ? BigInt(payload) : UNREADABLE;
}

function revive(node: unknown): unknown {
  if (Array.isArray(node)) {
    const items = node.map(revive);
    return items.includes(UNREADABLE) ? UNREADABLE : items;
  }
  if (!isRecord(node)) return node;

  const keys = Object.keys(node);
  if (keys.length === 1 && (keys[0] === "$date" || keys[0] === "$bigint")) {
    return reviveTagged(keys[0], node[keys[0]]);
  }

  const entries: Array<[string, unknown]> = [];
  for (const key of keys) {
    const value = revive(node[key]);
    if (value === UNREADABLE) return UNREADABLE;
    entries.push([key, value]);
  }
  // fromEntries définit des propriétés propres : une clé "__proto__" du JSON reste une donnée.
  return Object.fromEntries(entries);
}

function parseText(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return UNREADABLE;
  }
}

function hasShopShape(shop: unknown, slug: string): shop is CacheableShop {
  return (
    isRecord(shop) &&
    typeof shop.id === "string" &&
    shop.slug === slug &&
    Array.isArray(shop.products) &&
    shop.products.every((product) => isRecord(product) && typeof product.id === "string")
  );
}

/**
 * Accepte le texte JSON comme l'objet déjà analysé par @upstash/redis. Rend null sauf si
 * l'enveloppe porte la version courante et contient la boutique `slug` avec ses produits.
 */
export function decodeCachedShop<T extends CacheableShop>(raw: unknown, slug: string): T | null {
  const envelope = revive(parseText(raw));
  if (!isRecord(envelope) || envelope.v !== SHOP_CACHE_VERSION) return null;
  if (!hasShopShape(envelope.shop, slug)) return null;
  // Sûr tant que seul writeCachedShop écrit sous shopCacheKey(slug) et que SHOP_CACHE_VERSION change
  // avec la requête de l'appelant (en-tête du module) : l'entrée est alors une valeur de type T.
  return envelope.shop as T;
}

export async function readCachedShop<T extends CacheableShop>(slug: string): Promise<T | null> {
  const key = shopCacheKey(slug);
  const raw = await redis.get<unknown>(key);
  if (raw === null) return null;
  const shop = decodeCachedShop<T>(raw, slug);
  if (shop === null) logger.warn("[shop-cache] entrée illisible ignorée", { key });
  return shop;
}

export async function writeCachedShop(slug: string, shop: CacheableShop): Promise<void> {
  await redis.set(shopCacheKey(slug), encodeCachedShop(shop), { ex: SHOP_CACHE_TTL_SECONDS });
}

/**
 * Drops the cached shop, after every decision that changes what its page shows or whether it
 * exists (admin moderation, vacation start and end): the page reads the database at once.
 */
export async function invalidateCachedShop(slug: string): Promise<void> {
  await redis.del(shopCacheKey(slug));
}
