"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { SHOPS, OFFERS } from "@/lib/seed/data";
import { Badge, Card, Avatar } from "@/components/ui/shared";
import { SecretTapLogo } from "@/components/layout/secret-logo";

const FILTERS = ["Ouvert", "Express < 45 min", "Halal", "Dernière minute", "Traiteur"];

export default function DecouvrirPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const shops = [...SHOPS]
    .sort((a, b) => Number(!!b.halal) - Number(!!a.halal))
    .filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.city.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "Ouvert" && !s.isOpen) return false;
      if (filter === "Halal" && !s.halal) return false;
      if (filter === "Express < 45 min" && !s.nextSlotLabel) return false;
      return true;
    });

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ─── Sticky Header ─── */}
      <div className="sticky top-0 z-30 bg-stone-50/85 backdrop-blur-xl border-b border-stone-200">
        <div className="mx-auto max-w-[1100px] px-5 py-3.5">
          {/* Top bar */}
          <div className="flex justify-between items-center mb-3.5">
            <SecretTapLogo />
            <Link
              href="/panier"
              className="relative w-[42px] h-[42px] rounded-[10px] border border-stone-200 bg-white grid place-items-center shadow-sm text-lg hover:shadow-md transition-shadow"
            >
              🛒
            </Link>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2.5 bg-white rounded-[14px] px-4 py-3 border border-stone-200 shadow-sm">
            <span className="text-stone-400 text-base">🔎</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une boucherie, un quartier…"
              className="flex-1 bg-transparent text-sm outline-none text-stone-900 placeholder:text-stone-400"
            />
            <button className="px-3 py-1.5 rounded-[10px] border border-stone-200 bg-white text-sm shadow-sm hover:bg-stone-50 transition">
              📍
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(filter === f ? null : f)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                  filter === f
                    ? "border-[#7A1023] bg-[#FDF2F4] text-[#7A1023]"
                    : "border-stone-200 bg-white text-stone-900 hover:bg-stone-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main ─── */}
      <main className="mx-auto max-w-[1100px] px-5 py-7">
        <div className="grid lg:grid-cols-[1fr_330px] gap-9 items-start">
          {/* Col 1: Boucheries */}
          <section>
            <div className="flex justify-between items-end">
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight">
                  Boucheries à Chambéry
                </h1>
                <p className="mt-1.5 text-sm text-stone-500">
                  Choisis ta boucherie, retire rapidement.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {shops.map((shop, i) => (
                <Link key={shop.id} href={`/boucherie/${shop.id}`}>
                  <Card
                    className={`p-[18px] animate-fade-up`}
                    style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
                  >
                    <div className="flex gap-3.5">
                      <Avatar src={shop.imageUrl} name={shop.name} size={52} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2.5">
                          <div className="min-w-0">
                            <p className="text-[15px] font-bold tracking-tight truncate">
                              {shop.name}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {shop.distanceLabel} • {shop.city}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {shop.isOpen ? (
                              <Badge variant="open">● Ouvert • {shop.closesAt}</Badge>
                            ) : (
                              <Badge variant="closed">● Fermé • ouvre à {shop.opensAt}</Badge>
                            )}
                            {shop.nextSlotLabel && (
                              <Badge variant="express">⚡ Express {shop.nextSlotLabel}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {shop.halal && <Badge variant="halal">☪ Halal</Badge>}
                          {shop.tags?.slice(0, 2).map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                          {shop.rating && (
                            <Badge>
                              ⭐ {shop.rating.toFixed(1)} • {shop.reviewsCount} avis
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
              {shops.length === 0 && (
                <div className="rounded-[20px] border border-stone-200 bg-white p-8 text-sm text-stone-500 text-center animate-fade-in">
                  🔍 Aucune boucherie trouvée. Essaie un autre filtre.
                </div>
              )}
            </div>
          </section>

          {/* Col 2: Sidebar promos */}
          <aside className="lg:sticky lg:top-[200px]">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="font-display text-[17px] font-bold">🔥 Dernière minute</h2>
                <p className="mt-1 text-xs text-stone-500">Stock limité, prix réduits.</p>
              </div>
              <Link
                href="/bons-plans"
                className="text-xs font-semibold text-[#7A1023] underline underline-offset-4"
              >
                Voir tout
              </Link>
            </div>

            <div className="mt-3.5 flex flex-col gap-3">
              {OFFERS.map((offer, i) => (
                <Card
                  key={offer.id}
                  className={`overflow-hidden animate-fade-up`}
                  style={{ animationDelay: `${(i + 3) * 70}ms` } as React.CSSProperties}
                >
                  <div className="relative h-[120px] bg-stone-100">
                    {offer.imageUrl && (
                      <img
                        src={offer.imageUrl}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-2.5 left-2.5">
                      <Badge variant="promo">-{offer.percentOff}%</Badge>
                    </div>
                    <div className="absolute bottom-2.5 left-3 right-3">
                      <p className="text-[13px] font-bold text-white truncate">{offer.title}</p>
                      <p className="text-[10px] text-white/70 mt-0.5">{offer.shopName}</p>
                    </div>
                  </div>
                  <div className="p-3 flex justify-between items-end">
                    <div>
                      <p className="text-sm font-bold">{offer.price.toFixed(2)} €</p>
                      <p className="text-[11px] text-stone-400 line-through">
                        {offer.originalPrice.toFixed(2)} €
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-stone-500">{offer.expiresInMinutes} min</p>
                      <p className="text-[10px] text-orange-600 font-semibold">
                        {offer.qtyLeft} restant{offer.qtyLeft > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </aside>
        </div>
      </main>

      {/* ─── Footer discret ─── */}
      <footer className="mx-auto max-w-[1100px] px-5 py-8 border-t border-stone-200 flex justify-between items-center">
        <p className="text-[11px] text-stone-400">© 2026 ClickBoucher • Chambéry</p>
        <Link
          href="/sign-in"
          className="text-[11px] text-stone-400 underline underline-offset-4 hover:text-stone-600 transition"
        >
          Espace professionnel
        </Link>
      </footer>
    </div>
  );
}
