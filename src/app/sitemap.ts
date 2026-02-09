export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

const BASE_URL = "https://clickboucher-production.up.railway.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const shops = await prisma.shop.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/decouvrir`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const shopPages: MetadataRoute.Sitemap = shops.map((shop) => ({
    url: `${BASE_URL}/boutique/${shop.slug}`,
    lastModified: shop.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...shopPages];
}
