// src/app/(boucher)/boucher/images/page.tsx — Galerie d'images IA du boucher
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wand2, Search, Trash2, Copy, ImageOff, Loader2, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotify } from "@/components/ui/NotificationToast";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ImageModel = "PEXELS_SEARCH" | "UNSPLASH_SEARCH" | "FLUX_SCHNELL" | "FLUX_KONTEXT";

type GalleryImage = {
  id: string;
  prompt: string;
  model: string;
  imageUrl: string;
  width: number;
  height: number;
  usage: string;
  createdAt: string;
};

type GalleryResponse = {
  images: GalleryImage[];
  nextCursor: string | null;
  total: number;
};

const MODEL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  FLUX_SCHNELL: { label: "Générée", icon: "🪄", color: "text-purple-600 dark:text-purple-400" },
  FLUX_KONTEXT: { label: "Retouchée", icon: "🖼️", color: "text-blue-600 dark:text-blue-400" },
  PEXELS_SEARCH: { label: "Pexels", icon: "🔍", color: "text-emerald-600 dark:text-emerald-400" },
  UNSPLASH_SEARCH: { label: "Unsplash", icon: "🔍", color: "text-emerald-600 dark:text-emerald-400" },
};

const USAGE_LABELS: Record<string, string> = {
  PRODUCT: "Produit",
  PROMO: "Promo",
  CAMPAIGN: "Campagne",
  SOCIAL: "Social",
  BANNER: "Bannière",
};

const MODEL_FILTERS: { value: ImageModel | ""; label: string }[] = [
  { value: "", label: "Tous les modèles" },
  { value: "FLUX_SCHNELL", label: "🪄 Générées (IA)" },
  { value: "FLUX_KONTEXT", label: "🖼️ Retouchées (IA)" },
  { value: "PEXELS_SEARCH", label: "🔍 Pexels" },
  { value: "UNSPLASH_SEARCH", label: "🔍 Unsplash" },
];

function relativeDate(iso: string): string {
  const d = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - d) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.round(h / 24);
  if (days < 30) return `il y a ${days}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function BoucherImagesGalleryPage() {
  const { notify } = useNotify();

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [usage, setUsage] = useState<string>("");
  const [model, setModel] = useState<ImageModel | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      params.set("limit", "24");
      if (cursor) params.set("cursor", cursor);
      if (usage) params.set("usage", usage);
      if (model) params.set("model", model);
      if (debouncedSearch) params.set("q", debouncedSearch);
      return `/api/boucher/images/gallery?${params.toString()}`;
    },
    [usage, model, debouncedSearch]
  );

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl());
      if (!res.ok) {
        setError("Impossible de charger la galerie");
        return;
      }
      const json: { success: boolean; data: GalleryResponse } = await res.json();
      setImages(json.data.images);
      setNextCursor(json.data.nextCursor);
      setTotal(json.data.total);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextCursor));
      if (!res.ok) throw new Error("load more failed");
      const json: { success: boolean; data: GalleryResponse } = await res.json();
      setImages((prev) => [...prev, ...json.data.images]);
      setNextCursor(json.data.nextCursor);
    } catch {
      notify("error", "Impossible de charger plus d'images");
    } finally {
      setLoadingMore(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      notify("success", "URL copiée");
    } catch {
      notify("error", "Impossible de copier");
    }
  }

  async function deleteImage(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/boucher/images/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        notify("error", json?.error?.message || "Suppression échouée");
        return;
      }
      setImages((prev) => prev.filter((img) => img.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      notify("success", "Image supprimée");
    } catch {
      notify("error", "Erreur de connexion");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  // Stats
  const countByModel = images.reduce<Record<string, number>>((acc, img) => {
    acc[img.model] = (acc[img.model] || 0) + 1;
    return acc;
  }, {});
  const generatedCount = countByModel.FLUX_SCHNELL || 0;
  const retouchedCount = countByModel.FLUX_KONTEXT || 0;
  const searchedCount = (countByModel.PEXELS_SEARCH || 0) + (countByModel.UNSPLASH_SEARCH || 0);

  const USAGE_FILTERS: { value: string; label: string }[] = [
    { value: "", label: "Tous" },
    { value: "PRODUCT", label: "Produit" },
    { value: "PROMO", label: "Promo" },
    { value: "CAMPAIGN", label: "Campagne" },
    { value: "SOCIAL", label: "Social" },
    { value: "BANNER", label: "Bannière" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-[#1A1A1A] to-[#2D2D2D] rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Wand2 size={20} className="text-[#DC2626]" />
                Galerie images IA
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Retrouve, réutilise et supprime tes images générées
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-white">{total}</p>
              <p className="text-[9px] text-gray-400 font-medium">Total</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-purple-400">{generatedCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">Générées</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-blue-400">{retouchedCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">Retouchées</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{searchedCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">Recherchées</p>
            </div>
          </div>
        </div>

        {/* SEARCH + MODEL FILTER */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par prompt..."
              className="pl-9 h-11 bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10 rounded-xl text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center"
              >
                <X size={12} className="text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ImageModel | "")}
            className="h-11 px-3 rounded-xl bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#DC2626]"
          >
            {MODEL_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* USAGE PILLS */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {USAGE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setUsage(f.value)}
              className={`shrink-0 min-h-[44px] px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                usage === f.value
                  ? "bg-[#DC2626] text-white"
                  : "bg-white dark:bg-[#141414] text-gray-500 dark:text-gray-400 border border-[#ece8e3] dark:border-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {error ? (
          <Card className="bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10 rounded-[14px]">
            <CardContent className="py-10 text-center text-sm text-red-500">{error}</CardContent>
          </Card>
        ) : loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-gray-200 dark:bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <Card className="bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10 rounded-[14px]">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <ImageOff className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Aucune image générée
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Va créer un produit pour utiliser le Studio IA
                </p>
              </div>
              <a
                href="/boucher/produits/nouveau"
                className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <Sparkles size={14} />
                Créer un produit
              </a>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {images.map((img) => (
                <ImageCard
                  key={img.id}
                  img={img}
                  onCopy={() => copyUrl(img.imageUrl)}
                  onAskDelete={() => setConfirmDeleteId(img.id)}
                />
              ))}
            </div>

            {nextCursor && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="min-h-[44px] rounded-xl bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-2" />
                      Chargement...
                    </>
                  ) : (
                    "Charger plus"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDeleteId && (
        <ConfirmDialog
          onConfirm={() => deleteImage(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
          loading={deletingId === confirmDeleteId}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Image Card
// ─────────────────────────────────────────────
function ImageCard({
  img,
  onCopy,
  onAskDelete,
}: {
  img: GalleryImage;
  onCopy: () => void;
  onAskDelete: () => void;
}) {
  const meta = MODEL_LABELS[img.model] || { label: img.model, icon: "🖼️", color: "text-gray-500" };
  const usageLabel = USAGE_LABELS[img.usage] || img.usage;

  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-[#ece8e3] dark:border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.imageUrl}
        alt={img.prompt.slice(0, 80)}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover object-center"
        onError={(e) => {
          (e.target as HTMLImageElement).style.opacity = "0.2";
        }}
      />

      {/* Top badge */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 pointer-events-none">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 dark:bg-black/70 backdrop-blur text-[10px] font-bold ${meta.color}`}
        >
          <span aria-hidden>{meta.icon}</span>
          {meta.label}
        </span>
        <span className="px-2 py-1 rounded-full bg-black/60 text-white text-[9px] font-semibold backdrop-blur">
          {relativeDate(img.createdAt)}
        </span>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex flex-col justify-end p-3">
        <p className="text-[11px] text-white/90 font-medium line-clamp-2 mb-2" title={img.prompt}>
          {img.prompt}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[9px] font-semibold uppercase">
            {usageLabel}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copier l'URL"
            className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-900 flex items-center justify-center transition-colors"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={onAskDelete}
            aria-label="Supprimer l'image"
            className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-full bg-[#DC2626] hover:bg-[#b91c1c] text-white flex items-center justify-center transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirm Dialog
// ─────────────────────────────────────────────
function ConfirmDialog({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5 shadow-xl">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          Supprimer cette image ?
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Cette action est définitive. L&apos;image sera retirée de la galerie et du stockage.
        </p>
        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl bg-[#DC2626] hover:bg-[#b91c1c] text-white"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Supprimer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
