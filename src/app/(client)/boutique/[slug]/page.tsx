export const revalidate = 30; // ISR — rebuild every 30s

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getShopImage } from "@/lib/product-images";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, Clock, MapPin } from "lucide-react";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import {
  ShopProductsClient,
  type CategoryData,
  type ProductData,
} from "@/components/shop/ShopProductsClient";
import { ReviewList } from "@/components/shop/ReviewList";
import { LoyaltyBadge } from "@/components/shop/LoyaltyBadge";
import { ShopSchema } from "@/components/seo/ShopSchema";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ProductSchema } from "@/components/seo/ProductSchema";
import { SEO_CITIES } from "@/lib/seo/cities";
import { OfferBanner } from "@/components/client/OfferBanner";
import { OfferProductSection } from "@/components/client/OfferProductSection";

// ── Cached shop query with Redis (shared between generateMetadata & page) ──

async function fetchShopFromDB(slug: string) {
  return prisma.shop.findUnique({
    where: { slug },
    include: {
      categories: { orderBy: { order: "asc" } },
      products: {
        where: { isActive: true },
        include: {
          category: true,
          images: { orderBy: { order: "asc" } },
          labels: true,
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
    },
  });
}

type ShopWithProducts = NonNullable<Awaited<ReturnType<typeof fetchShopFromDB>>>;

const getShop = cache(async (slug: string): Promise<ShopWithProducts | null> => {
  // Try Redis cache first (TTL 60s)
  const cacheKey = `shop:${slug}`;
  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      const parsed = (typeof cached === "string" ? JSON.parse(cached) : cached) as ShopWithProducts;
      // Restore Date objects
      if (parsed?.products) {
        for (const p of parsed.products) {
          if (p.promoEnd) p.promoEnd = new Date(p.promoEnd);
        }
      }
      return parsed;
    }
  } catch {}

  const shop = await fetchShopFromDB(slug);

  // Cache for 60 seconds
  if (shop) {
    try { await redis.set(cacheKey, JSON.stringify(shop), { ex: 60 }); } catch {}
  }

  return shop;
});

// ── Dynamic metadata for SEO ────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const shop = await getShop(params.slug);

  if (!shop) {
    return { title: "Boucherie introuvable" };
  }

  const title = `${shop.name} — Boucherie Halal à ${shop.city || "votre ville"}`;
  const description = `Commandez en ligne chez ${shop.name}${shop.city ? `, boucherie halal à ${shop.city}` : ""}. Click & collect, viande fraîche halal, retrait en boutique.${shop.description ? " " + shop.description.slice(0, 80) : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/boutique/${shop.slug}`,
      images: shop.imageUrl
        ? [{ url: shop.imageUrl, width: 1200, height: 630, alt: shop.name }]
        : [{ url: "/og-image.png", width: 1200, height: 630, alt: "Klik&Go" }],
      type: "website",
      siteName: "Klik&Go",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: shop.imageUrl ? [shop.imageUrl] : ["/og-image.png"],
    },
    alternates: {
      canonical: `${SITE_URL}/boutique/${shop.slug}`,
    },
  };
}

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
  params: { slug: string };
}) {
  const { slug } = params;

  let shop;
  try {
    shop = await getShop(slug);
  } catch {
    notFound();
  }

  if (!shop) notFound();

  // Favorites & proStatus are handled client-side (FavoriteButton + ShopProductsClient)
  // Removing server-side auth() allows this page to be ISR-cached (revalidate: 30s)

  // Fetch active offers for this shop (banner + eligible products)
  const now = new Date();
  const activeOffers = await prisma.offer.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: now },
      endDate: { gt: now },
      OR: [
        { shopId: shop.id },
        { proposals: { some: { shopId: shop.id, status: "ACCEPTED" } } },
      ],
    },
    select: {
      id: true, name: true, code: true, type: true, discountValue: true,
      diffBanner: true, bannerTitle: true, bannerSubtitle: true, bannerColor: true, bannerImageUrl: true,
      eligibleProducts: {
        where: { shopId: shop.id },
        select: {
          product: { select: { id: true, name: true, imageUrl: true, priceCents: true, unit: true } },
        },
      },
    },
  });

  // Banner offer (first with diffBanner)
  const bannerOffer = activeOffers.find((o) => o.diffBanner);

  // Eligible products from all offers
  const offerProducts = activeOffers.flatMap((o) =>
    o.eligibleProducts.map((ep) => ({
      id: ep.product.id,
      name: ep.product.name,
      imageUrl: ep.product.imageUrl,
      priceCents: ep.product.priceCents,
      unit: ep.product.unit,
      offerName: o.name,
      offerType: o.type,
      discountValue: o.discountValue,
      offerCode: o.code,
    }))
  );

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
    proPriceCents: null, // Pro pricing resolved client-side
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
    sliceOptions: p.sliceOptions as ProductData["sliceOptions"] ?? null,
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
    })),
  }));

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <ShopSchema shop={shop} />
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: `${SITE_URL}` },
          { name: "Boucheries", url: `${SITE_URL}/` },
          { name: shop.name, url: `${SITE_URL}/boutique/${shop.slug}` },
        ]}
      />
      {/* Product schemas for rich results (first 20 products) */}
      {shop.products.slice(0, 20).map((p) => (
        <ProductSchema
          key={p.id}
          product={{
            id: p.id,
            name: p.name,
            description: p.description,
            priceCents: p.priceCents,
            imageUrl: p.imageUrl,
            inStock: p.inStock,
            category: p.category,
          }}
          shop={{ name: shop.name, slug: shop.slug }}
        />
      ))}
      <div className="mx-auto max-w-5xl">
        {/* ═══════════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════════ */}
        <div className="relative mx-3 mt-3 rounded-[24px] overflow-hidden h-[300px]">
          {shop.imageUrl ? (
            <>
              <Image
                src={heroImg}
                alt={shop.name}
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
                className="object-cover"
                quality={80}
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </>
          ) : (
            <>
              {/* Gradient fallback when no shop image */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#DC2626] via-[#991b1b] to-[#450a0a]" />
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </>
          )}

          {/* Back button + Favorite */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <Link
              href="/"
              aria-label="Retour aux boucheries"
              className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white/85 backdrop-blur-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              <ArrowLeft size={17} className="text-[#333]" />
            </Link>
            <div className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white/85 backdrop-blur-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <FavoriteButton shopId={shop.id} size={18} />
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
              {shop.status === "BUSY" && (
                <span className="px-3 py-1.5 bg-amber-500/80 backdrop-blur-xl text-white text-xs font-bold rounded-[10px]">
                  Mode occupe
                </span>
              )}

              {/* Paused badge */}
              {(shop.status === "PAUSED" || shop.status === "AUTO_PAUSED") && (
                <span className="px-3 py-1.5 bg-amber-500/80 backdrop-blur-xl text-white text-xs font-bold rounded-[10px]">
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
          {/* SEO: link to city page */}
          {(() => {
            const cityMatch = SEO_CITIES.find((c) =>
              shop.city.toLowerCase().includes(c.name.toLowerCase())
            );
            return cityMatch ? (
              <Link
                href={`/boucherie-halal/${cityMatch.slug}`}
                className="inline-block text-xs text-[#DC2626] hover:underline mt-1.5"
              >
                Toutes les boucheries halal à {cityMatch.name} &rarr;
              </Link>
            ) : null;
          })()}
        </div>

        {/* ── Pause banner (visible to clients) ── */}
        {(shop.status === "PAUSED" || shop.status === "AUTO_PAUSED") && (
          <div className="mx-5 mb-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl flex items-center gap-2">
            <Clock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              Commandes temporairement suspendues
              {shop.pauseEndsAt && (
                <> — Reprise estimée à{" "}
                  <span className="font-bold">
                    {new Date(shop.pauseEndsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* OFFER BANNER */}
        {/* ═══════════════════════════════════════════ */}
        {bannerOffer && (
          <OfferBanner
            title={bannerOffer.bannerTitle || bannerOffer.name}
            subtitle={bannerOffer.bannerSubtitle}
            code={bannerOffer.code}
            color={bannerOffer.bannerColor || "red"}
            imageUrl={bannerOffer.bannerImageUrl}
            discountLabel={
              bannerOffer.type === "PERCENT" ? `-${bannerOffer.discountValue}%`
              : bannerOffer.type === "AMOUNT" ? `-${bannerOffer.discountValue}€`
              : bannerOffer.type === "FREE_DELIVERY" ? "Frais offerts"
              : bannerOffer.type === "BOGO" ? "1+1 offert"
              : bannerOffer.type === "BUNDLE" ? `Pack -${bannerOffer.discountValue}€`
              : bannerOffer.name
            }
          />
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* OFFER PRODUCTS */}
        {/* ═══════════════════════════════════════════ */}
        <OfferProductSection products={offerProducts} />

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
          proStatus={{ isPro: false }}
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
