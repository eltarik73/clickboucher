import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

// ── Synonym map ─────────────────────────────────
const SYNONYMS: Record<string, string[]> = {
  poulet: ["poulet", "volaille", "chicken"],
  boeuf: ["boeuf", "bœuf", "viande rouge"],
  "bœuf": ["boeuf", "bœuf", "viande rouge"],
  agneau: ["agneau", "mouton"],
  mouton: ["agneau", "mouton"],
  hache: ["hache", "haché", "kefta", "boulette"],
  "haché": ["hache", "haché", "kefta", "boulette"],
  kefta: ["hache", "haché", "kefta", "boulette"],
  grillade: ["grillade", "bbq", "barbecue", "brochette", "merguez"],
  bbq: ["grillade", "bbq", "barbecue", "brochette", "merguez"],
  barbecue: ["grillade", "bbq", "barbecue", "brochette", "merguez"],
  merguez: ["grillade", "bbq", "barbecue", "brochette", "merguez"],
  brochette: ["grillade", "bbq", "barbecue", "brochette", "merguez"],
  couscous: ["couscous", "collier", "épaule", "agneau coupé"],
  tajine: ["tajine", "ragoût", "mijoté", "bourguignon"],
  ragout: ["tajine", "ragoût", "mijoté", "bourguignon"],
  "ragoût": ["tajine", "ragoût", "mijoté", "bourguignon"],
  "mijoté": ["tajine", "ragoût", "mijoté", "bourguignon"],
};

function expandTokens(query: string): string[] {
  const raw = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const expanded = new Set<string>();

  for (const token of raw) {
    expanded.add(token);
    // Also add the original (with accents) if present in synonyms
    const originalTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
    for (const orig of originalTokens) {
      if (SYNONYMS[orig]) {
        // Limit to first 2 synonyms to reduce OR conditions
        for (const syn of SYNONYMS[orig].slice(0, 2)) {
          expanded.add(syn);
        }
      }
    }
    // Check normalized token too
    if (SYNONYMS[token]) {
      for (const syn of SYNONYMS[token].slice(0, 2)) {
        expanded.add(syn);
      }
    }
  }

  // Hard cap: max 6 tokens total to avoid excessive OR conditions
  return Array.from(expanded).slice(0, 6);
}

export async function searchProducts(
  query: string,
  shopId?: string,
  limit = 10
) {
  const tokens = expandTokens(query);
  if (tokens.length === 0) return [];

  // ── Cache lookup ──
  const cacheKey = `search:${tokens.sort().join(",")}:${shopId || "all"}:${limit}`;
  try {
    const cached = await redis.get<unknown[]>(cacheKey);
    if (cached) return cached;
  } catch {
    // Redis down — continue without cache
  }

  // Build OR conditions for each token across name + tags (description removed for perf)
  const orConditions = tokens.flatMap((token) => [
    { name: { contains: token, mode: "insensitive" as const } },
    { tags: { has: token } },
  ]);

  const where: Record<string, unknown> = {
    inStock: true,
    OR: orConditions,
  };

  if (shopId) {
    where.shopId = shopId;
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      proPriceCents: true,
      unit: true,
      promoPct: true,
      promoEnd: true,
      tags: true,
      imageUrl: true,
      shop: { select: { name: true, slug: true, prepTimeMin: true, busyMode: true, busyExtraMin: true } },
      category: { select: { name: true } },
    },
    take: limit * 3, // Fetch more for scoring
  });

  // ── Score by relevance ────────────────────────
  const scored = products.map((p) => {
    let score = 0;
    const nameLower = p.name.toLowerCase();
    const descLower = (p.description || "").toLowerCase();
    const tagsLower = p.tags.map((t) => t.toLowerCase());

    for (const token of tokens) {
      if (nameLower.includes(token)) score += 10;
      if (descLower.includes(token)) score += 3;
      if (tagsLower.some((t) => t.includes(token))) score += 5;
    }

    // Boost promos
    if (p.promoPct && p.promoEnd && new Date(p.promoEnd) > new Date()) {
      score += 2;
    }

    return { ...p, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);

  const results = scored.slice(0, limit).map(({ _score, ...product }) => ({
    ...product,
    price: (product.priceCents / 100).toFixed(2),
    proPrice: product.proPriceCents
      ? (product.proPriceCents / 100).toFixed(2)
      : null,
    prepTime: product.shop.busyMode
      ? product.shop.prepTimeMin + product.shop.busyExtraMin
      : product.shop.prepTimeMin,
    link: `/boutique/${product.shop.slug}`,
  }));

  // ── Cache store (TTL 120s) ──
  try {
    await redis.set(cacheKey, results, { ex: 120 });
  } catch {
    // Redis down — continue without cache
  }

  return results;
}
