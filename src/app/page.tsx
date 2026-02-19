export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import Image from "next/image";
import { StarRating } from "@/components/ui/StarRating";
import { getShopImage } from "@/lib/product-images";

// ─────────────────────────────────────────────────────────────
// AUTH CHECK — redirect if signed in
// ─────────────────────────────────────────────────────────────

async function getAuthAndShops() {
  const { userId } = await auth();
  if (userId) redirect("/decouvrir");

  let shops: {
    slug: string;
    name: string;
    city: string;
    imageUrl: string | null;
    rating: number;
    ratingCount: number;
    prepTimeMin: number;
    busyMode: boolean;
    busyExtraMin: number;
    status: string;
  }[] = [];

  try {
    shops = await prisma.shop.findMany({
      orderBy: { rating: "desc" },
      take: 4,
      select: {
        slug: true,
        name: true,
        city: true,
        imageUrl: true,
        rating: true,
        ratingCount: true,
        prepTimeMin: true,
        busyMode: true,
        busyExtraMin: true,
        status: true,
      },
    });
  } catch {
    /* DB unavailable — render page without shops */
  }

  return shops;
}

// ─────────────────────────────────────────────────────────────
// HERO LOGO (reused from /decouvrir)
// ─────────────────────────────────────────────────────────────

function HeroLogo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="relative">
        <div className="absolute inset-0 blur-2xl opacity-40 bg-[#DC2626] rounded-full scale-150" />
        <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 relative z-10">
          <defs>
            <linearGradient id="landingLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a83320" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#landingLogoGrad)" />
          <path
            d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z"
            fill="white"
          />
          <g className="animate-pulse">
            <line x1="75" y1="35" x2="88" y2="35" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <line x1="78" y1="45" x2="93" y2="45" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <line x1="75" y1="55" x2="86" y2="55" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </g>
        </svg>
      </div>
      <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-white tracking-tight">
        Klik<span className="text-white">&amp;</span>Go
      </h2>
      <p className="text-xs text-[#666] tracking-wider mt-1">by TkS26</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEPS DATA
// ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    emoji: "\uD83C\uDFEA",
    title: "Choisissez votre boucherie",
    description: "Parcourez les boucheries halal de Chambéry",
  },
  {
    emoji: "\uD83D\uDED2",
    title: "Composez votre commande",
    description: "Ajoutez vos produits et validez",
  },
  {
    emoji: "\uD83D\uDCF1",
    title: "Récupérez avec votre QR",
    description: "Présentez votre code au boucher",
  },
];

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default async function HomePage() {
  const shops = await getAuthAndShops();

  return (
    <div className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO — full screen, dark                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center bg-[#1A1A1A] overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#DC2626]/8 blur-[120px] rounded-full" />

        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
          <HeroLogo />

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.08]">
            Marre d&apos;attendre&nbsp;?
          </h1>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-[#DC2626] tracking-tight leading-[1.1]">
            Commandez, r&eacute;cup&eacute;rez.
          </h2>
          <p className="mt-5 text-lg sm:text-xl text-[#888] max-w-lg mx-auto">
            Z&eacute;ro file. Z&eacute;ro stress.{" "}
            <span className="text-white font-medium">100% frais.</span>
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/decouvrir"
              className="px-8 py-3.5 bg-[#DC2626] text-white font-semibold rounded-xl shadow-lg shadow-[#DC2626]/25 hover:bg-[#b91c1c] transition-all hover:shadow-[#DC2626]/40 text-sm sm:text-base"
            >
              Voir les boucheries
            </Link>
            <a
              href="#comment-ca-marche"
              className="px-8 py-3.5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/5 transition-all text-sm sm:text-base"
            >
              Comment &ccedil;a marche
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <div className="w-5 h-8 border-2 border-white/20 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* COMMENT CA MARCHE — white background                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="comment-ca-marche" className="bg-white py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-[#DC2626] uppercase tracking-widest mb-3">
            Simple et rapide
          </p>
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-[#1A1A1A] mb-16">
            Comment &ccedil;a marche
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map((step, idx) => (
              <div key={idx} className="flex flex-col items-center text-center group">
                {/* Number + emoji */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-[#DC2626]/5 rounded-2xl flex items-center justify-center group-hover:bg-[#DC2626]/10 transition-colors">
                    <span className="text-4xl">{step.emoji}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#DC2626] rounded-full flex items-center justify-center shadow-lg shadow-[#DC2626]/30">
                    <span className="text-white text-xs font-bold">{idx + 1}</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{step.title}</h3>
                <p className="text-sm text-[#777] max-w-[240px]">{step.description}</p>

                {/* Connector arrow (desktop only, not after last) */}
                {idx < STEPS.length - 1 && (
                  <div className="hidden md:block absolute" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BOUCHERIES POPULAIRES — cream background              */}
      {/* ═══════════════════════════════════════════════════════ */}
      {shops.length > 0 && (
        <section className="bg-[#f8f6f3] py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-center text-sm font-semibold text-[#DC2626] uppercase tracking-widest mb-3">
              Nos partenaires
            </p>
            <h2 className="text-center text-3xl sm:text-4xl font-bold text-[#1A1A1A] mb-4">
              Boucheries populaires
            </h2>
            <p className="text-center text-[#888] mb-12 max-w-md mx-auto">
              Les boucheries halal les mieux not&eacute;es de Chamb&eacute;ry
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {shops.map((shop, i) => {
                const effectiveTime =
                  shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
                const imgSrc = shop.imageUrl || getShopImage(i);

                return (
                  <Link
                    key={shop.slug}
                    href={`/boutique/${shop.slug}`}
                    className="group bg-white rounded-2xl border border-[#ece8e3] overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
                  >
                    {/* Image */}
                    <div className="relative h-44 overflow-hidden">
                      <Image
                        src={imgSrc}
                        alt={shop.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        quality={75}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                      {/* Prep badge */}
                      <div className="absolute top-3 left-3">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg text-white ${
                            effectiveTime <= 15
                              ? "bg-emerald-500/90"
                              : effectiveTime <= 30
                                ? "bg-amber-500/90"
                                : "bg-red-500/90"
                          }`}
                        >
                          {effectiveTime} min
                        </span>
                      </div>

                      {/* Closed badge */}
                      {(shop.status === "CLOSED" || shop.status === "VACATION") && (
                        <div className="absolute top-3 right-3">
                          <span className="px-2.5 py-1 bg-gray-600/90 text-white text-xs font-semibold rounded-lg">
                            Ferm&eacute;
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <h3 className="font-bold text-[#1A1A1A] group-hover:text-[#DC2626] transition-colors truncate">
                        {shop.name}
                      </h3>
                      <p className="text-xs text-[#999] mt-0.5">{shop.city}</p>

                      <div className="flex items-center gap-1.5 mt-3">
                        <StarRating value={Math.round(shop.rating)} size="sm" />
                        <span className="text-sm font-semibold text-[#1A1A1A]">
                          {shop.rating.toFixed(1)}
                        </span>
                        <span className="text-xs text-[#999]">({shop.ratingCount})</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="text-center mt-12">
              <Link
                href="/decouvrir"
                className="inline-block px-8 py-3.5 bg-[#DC2626] text-white font-semibold rounded-xl shadow-lg shadow-[#DC2626]/25 hover:bg-[#b91c1c] transition-all hover:shadow-[#DC2626]/40"
              >
                Voir toutes les boucheries
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FOOTER                                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <footer className="bg-[#0A0A0A] text-white py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col items-center text-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#DC2626] rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-base">K</span>
              </div>
              <span className="text-lg font-bold tracking-tight">
                Klik<span>&amp;</span>Go
              </span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#888]">
              <Link href="/decouvrir" className="hover:text-white transition-colors">
                Boucheries
              </Link>
              <span className="text-[#333]">|</span>
              <Link href="/sign-up" className="hover:text-white transition-colors">
                S&apos;inscrire
              </Link>
              <span className="text-[#333]">|</span>
              <span className="cursor-default">CGV</span>
              <span className="text-[#333]">|</span>
              <span className="cursor-default">Mentions l&eacute;gales</span>
            </div>

            {/* Copyright */}
            <p className="text-xs text-[#555]">
              &copy; 2026 Klik&amp;Go &mdash; Propuls&eacute; par TkS26
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
