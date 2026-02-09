"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Heart, MapPin, Clock, Store } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { FavoriteButton } from "@/components/ui/FavoriteButton";

type FavoriteShop = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  imageUrl: string | null;
  prepTimeMin: number;
  busyMode: boolean;
  busyExtraMin: number;
  isOpen: boolean;
  rating: number;
  ratingCount: number;
};

export default function FavorisPage() {
  const { userId } = useAuth();
  const [shops, setShops] = useState<FavoriteShop[]>([]);
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

  const handleRemove = (shopId: string) => {
    setShops((prev) => prev.filter((s) => s.id !== shopId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#1a1814] pb-20">
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-serif mb-6">
            Mes favoris
          </h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-[#2a2520] rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#1a1814] pb-20">
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-serif mb-6">
            Mes favoris
          </h1>
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
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#1a1814] pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-serif mb-6">
          Mes favoris
        </h1>

        {shops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart size={48} className="text-gray-300 dark:text-gray-600 mb-4" strokeWidth={1.5} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Pas encore de favoris
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
              Ajoutez vos boucheries preferees en appuyant sur le coeur pour les retrouver ici.
            </p>
            <Link
              href="/decouvrir"
              className="px-6 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors"
            >
              Decouvrir les boucheries
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {shops.map((shop) => {
              const effectiveTime = shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
              const imgSrc = shop.imageUrl || `https://images.unsplash.com/photo-1542901031-ec5eeb518506?w=600&h=400&fit=crop`;

              return (
                <Link
                  key={shop.id}
                  href={`/boutique/${shop.slug}`}
                  className={`flex gap-4 p-3 bg-white dark:bg-[#2a2520] border border-[#ece8e3] dark:border-[#3a3530] rounded-2xl shadow-sm hover:shadow-md transition-all ${
                    !shop.isOpen ? "opacity-60" : ""
                  }`}
                >
                  {/* Image */}
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={imgSrc}
                      alt={shop.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {!shop.isOpen && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">Ferme</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate font-serif">
                        {shop.name}
                      </h3>
                      <FavoriteButton
                        shopId={shop.id}
                        initialFavorite={true}
                        size={18}
                        className="shrink-0"
                      />
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <MapPin size={11} />
                      <span className="truncate">{shop.address}, {shop.city}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span>&#11088;</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {shop.rating.toFixed(1)}
                        </span>
                        <span className="text-gray-400">({shop.ratingCount})</span>
                      </div>
                      {shop.isOpen && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock size={11} />
                          <span className={
                            effectiveTime <= 15
                              ? "text-emerald-600 font-semibold"
                              : effectiveTime <= 30
                                ? "text-amber-600 font-semibold"
                                : "text-red-600 font-semibold"
                          }>
                            {effectiveTime} min
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
