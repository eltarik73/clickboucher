"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Heart, ArrowLeft } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { ShopCard, type ShopCardData } from "@/components/shop/ShopCard";

export default function FavorisPage() {
  const { userId } = useAuth();
  const [shops, setShops] = useState<ShopCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      if (res.ok && data.success) {
        setShops(data.data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) fetchFavorites();
    else setLoading(false);
  }, [userId, fetchFavorites]);

  const stickyHeader = (
    <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
        >
          <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mes favoris</h1>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-20">
        {stickyHeader}
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-[#141414] rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-20">
        {stickyHeader}
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart size={48} className="text-gray-300 dark:text-gray-600 mb-4" strokeWidth={1.5} />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Connectez-vous pour voir vos favoris
            </p>
            <Link
              href="/sign-in"
              className="px-6 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-20">
      {stickyHeader}
      <div className="max-w-3xl mx-auto px-4 pt-6">

        {shops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
                <Heart size={36} className="text-[#DC2626] animate-pulse" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-display">
              Pas encore de favoris
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
              Ajoutez vos boucheries préférées en appuyant sur le cœur pour les retrouver ici.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href="/"
                className="px-6 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors"
              >
                Découvrir les boucheries
              </Link>
              <Link
                href="/commandes"
                className="px-6 py-2.5 bg-white dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-[#ece8e3] dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors"
              >
                Mes commandes
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {shops.map((shop, i) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                variant="compact"
                index={i}
                isFavorite={true}
                onFavoriteToggle={(isFav) => {
                  if (!isFav) setShops((prev) => prev.filter((s) => s.id !== shop.id));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
