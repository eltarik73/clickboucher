// src/app/(client)/bons-plans/page.tsx — All active promos across all shops
// ISR: cached, revalidated every 60s (promos don't change every second)
export const revalidate = 300;

import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { listPublicOffers, type PublicOffer } from "@/lib/public-offers";
import { limitedStockOnSaleWhere } from "@/lib/pricing/limited-stock";
import { BonsPlansClient } from "./BonsPlansClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Bons plans & promos boucherie halal",
  description:
    "Toutes les promotions et offres flash des boucheries halal près de chez vous : anti-gaspi, packs, vente flash, ramadan. Économisez sur la viande halal en click & collect.",
  alternates: { canonical: `${SITE_URL}/bons-plans` },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Bons plans & promos boucherie halal | Klik&Go",
    description:
      "Promotions, anti-gaspi, packs et vente flash des boucheries halal. Économisez en click & collect.",
    url: `${SITE_URL}/bons-plans`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Bons plans halal Klik&Go" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bons plans & promos boucherie halal",
    description: "Promotions et offres anti-gaspi des boucheries halal en click & collect.",
    images: ["/og-image.png"],
  },
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
    promoFixedCents: number | null;
    origin: string | null;
    halalOrg: string | null;
    categories: { id: string; name: string; emoji: string | null }[];
    shop: { id: string; name: string; slug: string };
    images: { url: string; isPrimary: boolean }[];
  }[] = [];

  let platformPromos: PublicOffer[] = [];

  try {
    const now = new Date();

    const [products, promotions] = await Promise.all([
      // 1. Product-level promos (boucher discounts on products)
      prisma.product.findMany({
        where: {
          inStock: true,
          ...limitedStockOnSaleWhere,
          OR: [
            { promoPct: { gt: 0 }, promoEnd: null },
            { promoPct: { gt: 0 }, promoEnd: { gt: now } },
            { promoType: "FIXED_AMOUNT", promoFixedCents: { gt: 0 } },
          ],
        },
        include: {
          categories: true,
          shop: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1, select: { url: true, isPrimary: true } },
        },
        orderBy: [{ promoType: "asc" }, { promoPct: "desc" }],
      }),

      // 2. Promo codes meant for every visitor (allow-list of src/lib/public-offers.ts)
      listPublicOffers(now),
    ]);

    promos = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      priceCents: p.priceCents,
      unit: p.unit,
      promoPct: p.promoPct ?? 0,
      promoEnd: p.promoEnd?.toISOString() ?? null,
      promoType: p.promoType,
      promoFixedCents: p.promoFixedCents ?? null,
      origin: p.origin,
      halalOrg: p.halalOrg,
      categories: p.categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
      shop: p.shop,
      images: p.images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
    }));

    platformPromos = promotions;
  } catch (error) {
    // En production on relance : sous ISR, Next garde alors la dernière bonne page
    // au lieu de mettre en cache des listes vides. Repli silencieux en dev uniquement.
    if (process.env.NODE_ENV === "production") throw error;
  }

  // Extract unique categories
  const categorySet = new Map<string, { id: string; name: string; emoji: string | null }>();
  for (const p of promos) {
    for (const cat of p.categories) {
      if (!categorySet.has(cat.id)) {
        categorySet.set(cat.id, cat);
      }
    }
  }
  const categories = Array.from(categorySet.values());

  return (
    <BonsPlansClient promos={promos} categories={categories} platformPromos={platformPromos} />
  );
}
