// src/app/(client)/bons-plans/page.tsx — All active promos across all shops
export const dynamic = "force-dynamic";

import Link from "next/link";
import prisma from "@/lib/prisma";
import { getFlag, getOriginCountry } from "@/lib/flags";
import { BonsPlansClient } from "./BonsPlansClient";

export const metadata = {
  title: "Bons plans — Klik&Go",
  description: "Toutes les promotions et offres flash des boucheries pres de chez vous",
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

  try {
    const products = await prisma.product.findMany({
      where: {
        promoPct: { gt: 0 },
        inStock: true,
        OR: [
          { promoEnd: null },
          { promoEnd: { gt: new Date() } },
        ],
      },
      include: {
        category: true,
        shop: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true, isPrimary: true } },
      },
      orderBy: [{ promoType: "asc" }, { promoPct: "desc" }],
    });

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
  } catch {
    // Promo fetch failed — continue with empty list
  }

  // Extract unique categories
  const categorySet = new Map<string, { id: string; name: string; emoji: string | null }>();
  for (const p of promos) {
    if (!categorySet.has(p.category.id)) {
      categorySet.set(p.category.id, p.category);
    }
  }
  const categories = Array.from(categorySet.values());

  return <BonsPlansClient promos={promos} categories={categories} />;
}
