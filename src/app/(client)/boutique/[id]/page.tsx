export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { getShopImage } from "@/lib/product-images";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, Clock, MapPin } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { FavoriteButton } from "@/components/ui/FavoriteButton";

// ── Dynamic metadata for SEO ────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;
  const shop = await prisma.shop.findUnique({
    where: { slug },
    select: { name: true, city: true, description: true },
  });

  if (!shop) {
    return { title: "Boutique introuvable — Klik&Go" };
  }

  const desc = shop.description
    ? `Commandez chez ${shop.name} à ${shop.city}. ${shop.description}`
    : `Commandez chez ${shop.name} à ${shop.city}. Retrait rapide, zéro file.`;

  return {
    title: `${shop.name} — Klik&Go`,
    description: desc,
    openGraph: {
      title: `${shop.name} — Klik&Go`,
      description: desc,
      type: "website",
    },
  };
}
import {
  ShopProductsClient,
  type CategoryData,
  type ProductData,
} from "@/components/shop/ShopProductsClient";
import { ReviewList } from "@/components/shop/ReviewList";
import { LoyaltyBadge } from "@/components/shop/LoyaltyBadge";

// ── Prep time color helper ───────────────────────

function prepTimeClasses(minutes: number) {
  if (minutes <= 15) return "text-emerald-400";
  if (minutes <= 30) return "text-amber-400";
  return "text-red-400";
}

// ── Page (Server Component) ──────────────────────

export default async function BoutiquePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = await params;

  let shop;
  try {
    shop = await prisma.shop.findUnique({
      where: { slug },
      include: {
        categories: { orderBy: { order: "asc" } },
        products: {
          include: {
            category: true,
            images: { orderBy: { order: "asc" } },
            labels: true,
          },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        },
      },
    });
  } catch (error) {
    console.error("[BoutiquePage] Prisma error:", error);
    notFound();
  }

  if (!shop) notFound();

  // Check if user has this shop as favorite
  let isFavorite = false;
  try {
    const { userId: clerkId } = await auth();
    if (clerkId) {
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { favoriteShops: { where: { id: shop.id }, select: { id: true } } },
      });
      isFavorite = (user?.favoriteShops.length ?? 0) > 0;
    }
  } catch { /* ignore — non-critical */ }

  const effectiveTime =
    shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
  const heroImg = shop.imageUrl || getShopImage(0);

  // Serialize for client component (strip Prisma internals / Date objects)
  const categories: CategoryData[] = shop.categories.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
  }));

  const products: ProductData[] = shop.products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    priceCents: p.priceCents,
    unit: p.unit,
    inStock: p.inStock,
    tags: p.tags,
    origin: p.origin,
    halalOrg: p.halalOrg,
    race: p.race,
    freshness: p.freshness,
    popular: p.popular,
    promoPct: p.promoPct,
    promoEnd: p.promoEnd ? p.promoEnd.toISOString() : null,
    promoType: p.promoType,
    customerNote: p.customerNote,
    minWeightG: p.minWeightG,
    weightStepG: p.weightStepG,
    maxWeightG: p.maxWeightG,
    category: {
      id: p.category.id,
      name: p.category.name,
      emoji: p.category.emoji,
    },
    images: p.images.map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      order: img.order,
      isPrimary: img.isPrimary,
    })),
    labels: p.labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      icon: l.icon,
    })),
  }));

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-5xl">
        {/* ═══════════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════════ */}
        <div className="relative mx-3 mt-3 rounded-[24px] overflow-hidden h-[300px]">
          <img
            src={heroImg}
            alt={shop.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Back button + Favorite */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <Link
              href="/decouvrir"
              className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white/85 backdrop-blur-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              <ArrowLeft size={17} className="text-[#333]" />
            </Link>
            <div className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white/85 backdrop-blur-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <FavoriteButton shopId={shop.id} initialFavorite={isFavorite} size={18} />
            </div>
          </div>

          {/* Shop info overlay */}
          <div className="absolute bottom-6 left-5 right-5">
            <h1 className="text-white text-[28px] sm:text-[30px] font-bold leading-[1.05]">
              {shop.name}
            </h1>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {/* Rating */}
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-xl px-3 py-1.5 rounded-[10px]">
                <Star size={12} className="text-yellow-300 fill-yellow-300" />
                <span className="text-xs font-bold text-white">
                  {shop.rating.toFixed(1)} · {shop.ratingCount} avis
                </span>
              </div>

              {/* Prep time */}
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-xl px-3 py-1.5 rounded-[10px]">
                <Clock size={11} className="text-white" />
                <span
                  className={`text-xs font-bold ${prepTimeClasses(effectiveTime)}`}
                >
                  {effectiveTime} min
                </span>
                {effectiveTime <= 15 && (
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                )}
              </div>

              {/* Busy mode badge */}
              {shop.busyMode && (
                <span className="px-3 py-1.5 bg-amber-500/80 backdrop-blur-xl text-white text-xs font-bold rounded-[10px]">
                  Mode occupe
                </span>
              )}

              {/* Paused badge */}
              {shop.paused && (
                <span className="px-3 py-1.5 bg-red-500/80 backdrop-blur-xl text-white text-xs font-bold rounded-[10px]">
                  Pause
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* INFO BAR */}
        {/* ═══════════════════════════════════════════ */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <MapPin size={12} />
            <span>
              {shop.address}, {shop.city}
            </span>
          </div>
          {shop.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{shop.description}</p>
          )}
          <p className="text-xs font-medium text-gray-900 dark:text-gray-300 mt-1">
            Retrait le plus tot :{" "}
            {new Date(Date.now() + effectiveTime * 60_000).toLocaleTimeString(
              "fr-FR",
              { hour: "2-digit", minute: "2-digit" }
            )}
          </p>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* LOYALTY BADGE */}
        {/* ═══════════════════════════════════════════ */}
        <LoyaltyBadge shopId={shop.id} />

        {/* ═══════════════════════════════════════════ */}
        {/* CLIENT-SIDE: categories, products, cart */}
        {/* ═══════════════════════════════════════════ */}
        <ShopProductsClient
          products={products}
          categories={categories}
          shop={{ id: shop.id, name: shop.name, slug: shop.slug }}
        />

        {/* ═══════════════════════════════════════════ */}
        {/* REVIEWS */}
        {/* ═══════════════════════════════════════════ */}
        <ReviewList
          shopId={shop.id}
          rating={shop.rating}
          ratingCount={shop.ratingCount}
        />
      </div>
    </div>
  );
}
