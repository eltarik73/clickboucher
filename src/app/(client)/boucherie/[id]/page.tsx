"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { SHOPS, PRODUCTS } from "@/lib/seed/data";
import { Badge, Card, Btn, StickyHeader, BackBtn } from "@/components/ui/shared";
import { getShopImage } from "@/lib/product-images";
import type { Product } from "@/types";

export default function BoutiquePage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params.id as string;

  const shop = SHOPS.find((s) => s.id === shopId);
  const products = PRODUCTS.filter((p) => p.shopId === shopId);
  const [addedId, setAddedId] = useState<string | null>(null);

  const addToCart = (item: Product) => {
    const raw = localStorage.getItem("cb_cart");
    const cart = raw ? JSON.parse(raw) : [];
    const exists = cart.find((c: any) => c.id === item.id);
    if (exists) {
      exists.qty += 1;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    localStorage.setItem("cb_cart", JSON.stringify(cart));
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 600);
    window.dispatchEvent(new Event("cart-updated"));
  };

  if (!shop) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-stone-500">Boucherie introuvable.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <StickyHeader>
        <BackBtn onClick={() => router.push("/decouvrir")} />
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-bold truncate">{shop.name}</p>
          <p className="text-xs text-stone-500">{shop.distanceLabel} • {shop.city}</p>
        </div>
        <Link
          href="/panier"
          className="relative w-10 h-10 rounded-[10px] border border-stone-200 bg-white grid place-items-center text-[17px]"
        >
          🛒
        </Link>
      </StickyHeader>

      {/* Hero */}
      <div className="relative h-[190px] bg-stone-100">
        <img src={shop.imageUrl || getShopImage(SHOPS.indexOf(shop))} alt={shop.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        <div className="absolute bottom-3.5 left-5 flex gap-1.5">
          {shop.halal && <Badge variant="halal" className="bg-emerald-50/95">Halal</Badge>}
          {shop.isOpen ? (
            <Badge variant="open" className="bg-green-50/95">Ouvert</Badge>
          ) : (
            <Badge variant="closed" className="bg-red-50/95">Ferme</Badge>
          )}
          {shop.nextSlotLabel && (
            <Badge variant="express" className="bg-orange-50/95">{shop.nextSlotLabel}</Badge>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-[800px] px-5 py-7">
        {/* Products */}
        <h2 className="font-display text-xl font-bold mb-3.5">Produits</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {products.map((p, i) => (
            <Card
              key={p.id}
              className={`p-4 animate-fade-up ${!p.stock ? "opacity-40" : ""}`}
              style={{ animationDelay: `${i * 50}ms` } as React.CSSProperties}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold">{p.name}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {p.publicPrice.toFixed(2)} EUR / {p.unit}
                  </p>
                </div>
                <button
                  onClick={() => p.stock && addToCart(p)}
                  disabled={!p.stock}
                  className={`w-9 h-9 rounded-[10px] border-none text-white text-lg grid place-items-center shrink-0 transition-all ${
                    addedId === p.id
                      ? "bg-green-500"
                      : "bg-[#DC2626] hover:bg-[#9B1B32]"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {addedId === p.id ? "+" : "+"}
                </button>
              </div>
              <div className="mt-2 flex gap-1.5">
                {!p.stock && <Badge variant="closed">Indisponible</Badge>}
                {p.stock && <Badge variant="express">~{p.prepTime} min</Badge>}
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
