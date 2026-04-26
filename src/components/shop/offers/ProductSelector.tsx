// src/components/shop/offers/ProductSelector.tsx — Select eligible products for an offer
"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Check, Loader2, Package, Search } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
}

interface OfferProduct {
  productId: string;
  product: Product;
}

export function ProductSelector({
  offerId,
  onDone,
}: {
  offerId: string;
  onDone: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, selRes] = await Promise.all([
        fetch("/api/products"),
        fetch(`/api/shop/offers/${offerId}/products`),
      ]);

      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        const allProducts: Product[] = (prodJson.data || []).map(
          (p: { id: string; name: string; imageUrl: string | null; priceCents: number }) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            priceCents: p.priceCents,
          })
        );
        setProducts(allProducts);
      }

      if (selRes.ok) {
        const selJson = await selRes.json();
        const existing: OfferProduct[] = selJson.data || [];
        setSelectedIds(new Set(existing.map((op) => op.productId)));
      }
    } catch {
      toast.error("Impossible de charger les produits");
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast.error("Sélectionnez au moins un produit");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/shop/offers/${offerId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Erreur");
      }

      toast.success(`${selectedIds.size} produit${selectedIds.size > 1 ? "s" : ""} associé${selectedIds.size > 1 ? "s" : ""}`);
      onDone();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] p-4 md:p-6 lg:p-8 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onDone}
          className="w-9 h-9 rounded-xl bg-white dark:bg-[#141414] border border-gray-100 dark:border-white/10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={16} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Sélectionnez les produits éligibles
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choisissez les produits concernés par cette offre
          </p>
        </div>
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          {selectedIds.size}
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-500 dark:text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Package size={24} className="text-gray-500 dark:text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {search ? "Aucun produit trouvé" : "Aucun produit disponible"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((product) => {
            const selected = selectedIds.has(product.id);
            return (
              <button
                key={product.id}
                onClick={() => toggleProduct(product.id)}
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  selected
                    ? "border-emerald-400 dark:border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-500/10"
                    : "border-gray-100 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-gray-200 dark:hover:border-white/20"
                }`}
              >
                {/* Image */}
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-white/5 overflow-hidden shrink-0">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={20} className="text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {product.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {(product.priceCents / 100).toFixed(2)}&nbsp;&euro;
                  </p>
                </div>

                {/* Selected badge */}
                {selected && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 shrink-0">
                    <Check size={12} />
                    Éligible
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Sticky bottom bar */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-gray-100 dark:border-white/10 z-50">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleSubmit}
              disabled={saving || selectedIds.size === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Confirmer ({selectedIds.size} produit{selectedIds.size !== 1 ? "s" : ""})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
