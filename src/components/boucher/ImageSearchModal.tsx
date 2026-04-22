// src/components/boucher/ImageSearchModal.tsx — Modale de recherche d'images web
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, Loader2, ExternalLink, ImageOff } from "lucide-react";

type SearchResult = {
  id: string;
  url: string;
  thumbUrl: string;
  author: string;
  authorUrl: string;
  source: "pexels" | "unsplash";
  width: number;
  height: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, alt: string) => void;
  defaultQuery?: string;
  usage?: "PRODUCT" | "CAMPAIGN" | "BANNER";
};

const PRESETS = [
  "Viande bœuf",
  "Côte de bœuf",
  "Escalope poulet",
  "Merguez",
  "Brochettes",
  "Agneau halal",
  "Steak haché",
  "Charcuterie halal",
];

export default function ImageSearchModal({
  open,
  onClose,
  onSelect,
  defaultQuery = "",
  usage = "PRODUCT",
}: Props) {
  const [query, setQuery] = useState(defaultQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(defaultQuery);
      setResults([]);
      setError(null);
      setHasSearched(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultQuery]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function runSearch(q: string) {
    const term = q.trim();
    if (term.length < 2) {
      setError("Saisis au moins 2 caractères");
      return;
    }
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/boucher/images/search?q=${encodeURIComponent(term)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Erreur de recherche");
        setResults([]);
        return;
      }
      setConfigured(Boolean(json.data.configured));
      setResults(json.data.results || []);
    } catch (e) {
      setError((e as Error).message || "Erreur réseau");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePick(r: SearchResult) {
    setImportingId(r.id);
    setError(null);
    try {
      const res = await fetch("/api/boucher/images/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: r.url, source: r.source, query, usage }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Échec de l'import");
        return;
      }
      onSelect(json.data.url, query || "image");
      onClose();
    } catch (e) {
      setError((e as Error).message || "Erreur réseau");
    } finally {
      setImportingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl h-[95vh] sm:h-[90vh] bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden font-[var(--font-outfit)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Chercher une image
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Images libres de droits — Pexels & Unsplash
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            className="flex gap-2"
          >
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: côte de bœuf, merguez..."
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#141414] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-4 sm:px-5 rounded-xl bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span className="hidden sm:inline">Chercher</span>
            </button>
          </form>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setQuery(p);
                  runSearch(p);
                }}
                className="h-9 px-3 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-[#DC2626] hover:text-white text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors border border-transparent hover:border-[#DC2626]"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {error && (
            <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {!configured && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              Recherche web non configurée. Ajoute <code className="font-mono">PEXELS_API_KEY</code> dans les variables d'environnement.
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={32} className="animate-spin text-[#DC2626]" />
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && configured && !error && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <ImageOff size={40} className="text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Aucune image trouvée. Essaie avec des mots-clés différents.
              </p>
            </div>
          )}

          {!hasSearched && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Search size={40} className="text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Lance une recherche ou clique un preset ci-dessus.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {results.map((r) => {
                const isImporting = importingId === r.id;
                return (
                  <div key={r.id} className="group">
                    <button
                      type="button"
                      onClick={() => handlePick(r)}
                      disabled={Boolean(importingId)}
                      className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#DC2626] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbUrl}
                        alt={r.author}
                        loading="lazy"
                        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        {isImporting ? (
                          <div className="bg-white/95 dark:bg-black/80 rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-gray-900 dark:text-white">
                            <Loader2 size={14} className="animate-spin" />
                            Import...
                          </div>
                        ) : (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#DC2626] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                            Utiliser cette image
                          </span>
                        )}
                      </div>
                      <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase bg-black/70 text-white px-2 py-0.5 rounded">
                        {r.source}
                      </span>
                    </button>
                    <div className="mt-1.5 px-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      Par{" "}
                      <a
                        href={r.authorUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:text-[#DC2626] inline-flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.author}
                        <ExternalLink size={10} />
                      </a>{" "}
                      sur {r.source === "pexels" ? "Pexels" : "Unsplash"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer link */}
        <div className="shrink-0 border-t border-[#ece8e3] dark:border-white/10 px-4 sm:px-6 py-3 bg-gray-50 dark:bg-white/5">
          <a
            href="/boucher/images"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] hover:underline min-h-[44px]"
          >
            📚 Voir mes images précédentes
          </a>
        </div>
      </div>
    </div>
  );
}
