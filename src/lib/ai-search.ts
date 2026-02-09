import prisma from "@/lib/prisma";

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
        for (const syn of SYNONYMS[orig]) {
          expanded.add(syn);
        }
      }
    }
    // Check normalized token too
    if (SYNONYMS[token]) {
      for (const syn of SYNONYMS[token]) {
        expanded.add(syn);
      }
    }
  }

  return Array.from(expanded);
}

export async function searchProducts(
  query: string,
  shopId?: string,
  limit = 10
) {
  const tokens = expandTokens(query);
  if (tokens.length === 0) return [];

  // Build OR conditions for each token across name, description, tags
  const orConditions = tokens.flatMap((token) => [
    { name: { contains: token, mode: "insensitive" as const } },
    { description: { contains: token, mode: "insensitive" as const } },
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

  return scored.slice(0, limit).map(({ _score, ...product }) => ({
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
}
