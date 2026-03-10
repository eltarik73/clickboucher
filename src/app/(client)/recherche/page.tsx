"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, MapPin, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SafeImage } from "@/components/ui/SafeImage";

interface SearchResult {
  id: string;
  name: string;
  type: "shop" | "product";
  imageUrl?: string | null;
  shopName?: string;
  shopSlug?: string;
  slug?: string;
  priceCents?: number;
  unit?: string;
  category?: string;
  address?: string;
}

export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const [productsRes, shopsRes] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/api/shops?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => []),
      ]);

      const shopResults: SearchResult[] = (Array.isArray(shopsRes) ? shopsRes : shopsRes.shops || [])
        .slice(0, 5)
        .map((s: Record<string, string>) => ({
          id: s.id,
          name: s.name,
          type: "shop" as const,
          imageUrl: s.imageUrl,
          slug: s.slug,
          address: s.address,
        }));

      const productResults: SearchResult[] = (productsRes.results || [])
        .slice(0, 10)
        .map((p: Record<string, string | number | null>) => ({
          id: p.id as string,
          name: p.name as string,
          type: "product" as const,
          imageUrl: p.imageUrl as string | null,
          shopName: p.shopName as string,
          shopSlug: p.shopSlug as string,
          priceCents: p.priceCents as number,
          unit: p.unit as string,
          category: p.categoryName as string,
        }));

      setResults([...shopResults, ...productResults]);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Search bar */}
      <div className="sticky top-0 z-30 bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/[0.08] px-4 py-3">
        <div className="relative max-w-2xl mx-auto">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une boucherie ou un produit..."
            autoFocus
            className="w-full h-12 pl-10 pr-10 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm font-medium outline-none focus:ring-2 focus:ring-[#DC2626]/30 transition-shadow"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10"
              aria-label="Effacer la recherche"
            >
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* No query */}
        {!loading && !searched && (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" strokeWidth={1.5} />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Tapez au moins 2 caracteres pour rechercher
            </p>
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" strokeWidth={1.5} />
            <p className="text-gray-900 dark:text-white font-semibold mb-1">
              Aucun resultat
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Essayez avec d&apos;autres termes
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="space-y-2">
            {/* Shops */}
            {results.filter(r => r.type === "shop").length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-2">
                  Boucheries
                </p>
                {results
                  .filter(r => r.type === "shop")
                  .map(shop => (
                    <Link
                      key={shop.id}
                      href={`/boutique/${shop.slug}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/[0.06] hover:border-[#DC2626]/30 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/10 overflow-hidden shrink-0">
                        {shop.imageUrl ? (
                          <SafeImage
                            src={shop.imageUrl}
                            alt={shop.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <MapPin size={20} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {shop.name}
                        </p>
                        {shop.address && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {shop.address}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
              </>
            )}

            {/* Products */}
            {results.filter(r => r.type === "product").length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-2 mt-4">
                  Produits
                </p>
                {results
                  .filter(r => r.type === "product")
                  .map(product => (
                    <Link
                      key={product.id}
                      href={`/boutique/${product.shopSlug}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/[0.06] hover:border-[#DC2626]/30 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/10 overflow-hidden shrink-0">
                        {product.imageUrl ? (
                          <SafeImage
                            src={product.imageUrl}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">
                            🥩
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {product.shopName}
                          {product.category && ` · ${product.category}`}
                        </p>
                      </div>
                      {product.priceCents && (
                        <span className="text-sm font-bold text-[#DC2626] shrink-0">
                          {(product.priceCents / 100).toFixed(2).replace(".", ",")}€
                        </span>
                      )}
                    </Link>
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
