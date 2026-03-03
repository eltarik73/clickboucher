// src/app/(client)/bons-plans/page.tsx — All active promos across all shops
// ISR: cached, revalidated every 60s (promos don't change every second)
export const revalidate = 60;

import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { BonsPlansClient } from "./BonsPlansClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Bons Plans & Promotions Boucherie Halal",
  description: "Toutes les promotions et offres flash des boucheries halal près de chez vous. Réductions, offres du moment, codes promo.",
  alternates: { canonical: `${SITE_URL}/bons-plans` },
};

export default async function BonsPlansPage() {
  let promos: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    priceCents: number;
    unit: string;
    promoPct: number;
    promoEnd: string | null;
    promoType: string | null;
    origin: string | null;
    halalOrg: string | null;
    category: { id: string; name: string; emoji: string | null };
    shop: { id: string; name: string; slug: string };
    images: { url: string; isPrimary: boolean }[];
  }[] = [];

  let platformPromos: {
    id: string;
    label: string;
    description: string | null;
    type: string;
    valueCents: number | null;
    valuePercent: number | null;
    code: string | null;
    endsAt: string;
    shopName: string | null;
    shopSlug: string | null;
  }[] = [];

  try {
    const now = new Date();

    const [products, promotions] = await Promise.all([
      // 1. Product-level promos (boucher discounts on products)
      prisma.product.findMany({
        where: {
          promoPct: { gt: 0 },
          inStock: true,
          OR: [
            { promoEnd: null },
            { promoEnd: { gt: now } },
          ],
        },
        include: {
          category: true,
          shop: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1, select: { url: true, isPrimary: true } },
        },
        orderBy: [{ promoType: "asc" }, { promoPct: "desc" }],
      }),

      // 2. Active offers (from Marketing Hub)
      prisma.offer.findMany({
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gt: now },
        },
        include: { shop: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    promos = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      priceCents: p.priceCents,
      unit: p.unit,
      promoPct: p.promoPct!,
      promoEnd: p.promoEnd?.toISOString() ?? null,
      promoType: p.promoType,
      origin: p.origin,
      halalOrg: p.halalOrg,
      category: { id: p.category.id, name: p.category.name, emoji: p.category.emoji },
      shop: p.shop,
      images: p.images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
    }));

    platformPromos = promotions.map((o) => ({
      id: o.id,
      label: o.name,
      description: null,
      type: o.type,
      valueCents: o.type === "AMOUNT" ? Math.round(o.discountValue * 100) : null,
      valuePercent: o.type === "PERCENT" ? o.discountValue : null,
      code: o.code,
      endsAt: o.endDate.toISOString(),
      shopName: o.shop?.name || null,
      shopSlug: o.shop?.slug || null,
    }));
  } catch {
    // Promo fetch failed — continue with empty lists
  }

  // Extract unique categories
  const categorySet = new Map<string, { id: string; name: string; emoji: string | null }>();
  for (const p of promos) {
    if (!categorySet.has(p.category.id)) {
      categorySet.set(p.category.id, p.category);
    }
  }
  const categories = Array.from(categorySet.values());

  return <BonsPlansClient promos={promos} categories={categories} platformPromos={platformPromos} />;
}
