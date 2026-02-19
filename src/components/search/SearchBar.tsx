// src/components/search/SearchBar.tsx — Search with autocomplete, debounce, recent searches
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, X, Clock, ArrowRight, Timer } from "lucide-react";
import { resolveProductImage } from "@/lib/product-images";

interface SearchResult {
  id: string;
  name: string;
  priceCents: number;
  unit: string;
  shopName: string;
  shopSlug: string;
  category?: string;
  imageUrl?: string;
  prepTime?: number;
}

const RECENT_KEY = "klikgo-recent-searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch { return []; }
}

function addRecentSearch(q: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== q);
    recent.unshift(q);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {}
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.results || []).slice(0, 8).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          priceCents: r.priceCents as number,
          unit: r.unit as string,
          shopName: (r.shop as Record<string, string>)?.name || "",
          shopSlug: (r.shop as Record<string, string>)?.slug || "",
          category: (r.category as Record<string, string>)?.name,
          imageUrl: r.imageUrl as string | undefined,
          prepTime: r.prepTime as number | undefined,
        })));
      }
    } catch {}
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    addRecentSearch(result.name);
    setOpen(false);
    setQuery("");
    router.push(`/boutique/${result.shopSlug}`);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    setOpen(true);
    search(term);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      addRecentSearch(query.trim());
      search(query.trim());
    }
  };

  const showRecent = open && query.length < 2 && recentSearches.length > 0;
  const showResults = open && query.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      {/* Input */}
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher un produit, une viande..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white dark:bg-[#141414] border border-gray-200/80 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] transition-all shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {(showRecent || showResults) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#141414] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
          {/* Recent searches */}
          {showRecent && (
            <div className="p-3">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1">
                Recherches récentes
              </p>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleRecentClick(term)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                >
                  <Clock size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {showResults && (
            <div className="max-h-[320px] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loading && results.length === 0 && query.length >= 2 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500">Aucun résultat pour &quot;{query}&quot;</p>
                </div>
              )}

              {!loading && results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left border-b border-gray-50 dark:border-white/5 last:border-0"
                >
                  {/* Product thumbnail */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
                    <Image
                      src={resolveProductImage({ name: r.name, imageUrl: r.imageUrl || null, category: r.category || "" })}
                      alt={r.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <span className="truncate">{r.shopName}</span>
                      {r.category && <><span>·</span><span>{r.category}</span></>}
                      {r.prepTime && (
                        <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <Timer size={10} />
                          {r.prepTime}min
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {fmtPrice(r.priceCents)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      /{r.unit === "KG" ? "kg" : r.unit === "PIECE" ? "pièce" : "barq."}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
