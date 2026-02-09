import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, Clock, MapPin } from "lucide-react";
import prisma from "@/lib/prisma";
import {
  ShopProductsClient,
  type CategoryData,
  type ProductData,
} from "@/components/shop/ShopProductsClient";

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
          where: { inStock: true },
          include: { category: true },
          orderBy: { name: "asc" },
        },
      },
    });
  } catch (error) {
    console.error("[BoutiquePage] Prisma error:", error);
    notFound();
  }

  if (!shop) notFound();

  const effectiveTime =
    shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
  const heroImg = shop.imageUrl || "/images/boucherie-hero.webp";

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
    tags: p.tags,
    promoPct: p.promoPct,
    category: {
      id: p.category.id,
      name: p.category.name,
      emoji: p.category.emoji,
    },
  }));

  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      <div className="mx-auto max-w-5xl">
        {/* ═══════════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════════ */}
        <div className="relative mx-3 mt-3 rounded-[24px] overflow-hidden h-[300px]">
          <Image
            src={heroImg}
            alt={shop.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Back button */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <Link
              href="/decouvrir"
              className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white/85 backdrop-blur-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              <ArrowLeft size={17} className="text-[#333]" />
            </Link>
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
          <div className="flex items-center gap-1 text-xs text-[#999]">
            <MapPin size={12} />
            <span>
              {shop.address}, {shop.city}
            </span>
          </div>
          {shop.description && (
            <p className="text-xs text-[#7a7068] mt-1">{shop.description}</p>
          )}
          <p className="text-xs font-medium text-[#444] mt-1">
            Retrait le plus tot :{" "}
            {new Date(Date.now() + effectiveTime * 60_000).toLocaleTimeString(
              "fr-FR",
              { hour: "2-digit", minute: "2-digit" }
            )}
          </p>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* CLIENT-SIDE: categories, products, cart */}
        {/* ═══════════════════════════════════════════ */}
        <ShopProductsClient
          products={products}
          categories={categories}
          shop={{ id: shop.id, name: shop.name, slug: shop.slug }}
        />
      </div>
    </div>
  );
}
