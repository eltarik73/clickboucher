"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package,
  Check,
  Loader2,
  Search,
  Gift,
  Tag,
  X,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
type Product = {
  id: string;
  name: string;
  priceCents: number;
  unit: string;
  imageUrl?: string | null;
  category?: { name: string } | null;
  available: boolean;
};

type Props = {
  offerId: string;
  onDone: () => void;
};

// ── Helpers ────────────────────────────────────────────────
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

const UNIT_LABELS: Record<string, string> = {
  KG: "/kg",
  PIECE: "/pce",
  BARQUETTE: "/barq.",
  TRANCHE: "/tr.",
};

// ── Component ──────────────────────────────────────────────
export default function ProductSelector({ offerId, onDone }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products?shopId=mine");
      if (!res.ok) throw new Error();
      const json = await res.json();
      const prods = json.data?.products || json.data || [];
      setProducts(prods);
    } catch {
      toast.error("Impossible de charger vos produits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Toggle product selection ──
  function toggleProduct(productId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  // ── Select all / deselect all ──
  function toggleAll() {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  }

  // ── Submit ──
  async function handleConfirm() {
    if (selectedIds.size === 0) {
      toast.error("Sélectionnez au moins un produit");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shop/offers/${offerId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Erreur");
      }

      toast.success(`${selectedIds.size} produit${selectedIds.size > 1 ? "s" : ""} associé${selectedIds.size > 1 ? "s" : ""} à l'offre`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filter products ──
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back button */}
      <button
        onClick={onDone}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Retour aux offres
      </button>

      {/* Amber banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 flex items-center gap-2 mb-5">
        <Package size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
          Sélectionnez les produits éligibles pour cette offre
        </p>
        <span className="ml-auto px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 text-xs font-bold shrink-0">
          {selectedIds.size} produit{selectedIds.size !== 1 ? "s" : ""} sélectionné{selectedIds.size !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Left: Product grid ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + select all */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <button
              onClick={toggleAll}
              className="px-3 py-2.5 text-xs font-semibold bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              {selectedIds.size === filteredProducts.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>

          {/* Products grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {search ? "Aucun produit trouvé" : "Aucun produit dans votre catalogue"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((product) => {
                const isSelected = selectedIds.has(product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all text-left ${
                      isSelected
                        ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md"
                        : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 bg-white dark:bg-white/5"
                    }`}
                  >
                    {/* Selection check */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}

                    {/* Offer badge */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center gap-0.5 shadow-sm">
                        <Gift size={9} />
                        1+1
                      </div>
                    )}

                    {/* Image placeholder */}
                    <div className="bg-gray-100 dark:bg-white/10 rounded-lg h-24 w-full mb-2 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={24} className="text-gray-300 dark:text-gray-600" />
                      )}
                    </div>

                    {/* Name + price */}
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatPrice(product.priceCents)}
                        {UNIT_LABELS[product.unit] || ""}
                      </span>
                      {product.category && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {" "}
                          - {product.category.name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Summary panel (sticky on lg) ── */}
        <div className="lg:w-72 shrink-0">
          <div className="lg:sticky lg:top-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 p-5 space-y-4">
            {/* Offer info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Gift size={16} className="text-red-500" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Offre</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">ID: {offerId.slice(0, 12)}...</p>
            </div>

            <hr className="border-gray-100 dark:border-white/10" />

            {/* Selected products list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Produits sélectionnés
                </p>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedIds.size}
                </span>
              </div>

              {selectedProducts.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">
                  Aucun produit sélectionné
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {selectedProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-white/5"
                    >
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mr-2">
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {formatPrice(p.priceCents)}
                        </span>
                        <button
                          onClick={() => toggleProduct(p.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-gray-100 dark:border-white/10" />

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0 || submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-md shadow-emerald-600/20"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Tag size={16} />
                  Confirmer ({selectedIds.size} produit{selectedIds.size !== 1 ? "s" : ""})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
