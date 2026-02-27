"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Tag,
  Clock,
  AlertTriangle,
  ShoppingBag,
  Store,
  ArrowUpDown,
  X,
  ExternalLink,
  Flame,
  Star,
  ArrowUpRight,
  Loader2,
  CheckCircle,
} from "lucide-react";

/* ─── types ─── */
interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  proPriceCents: number | null;
  unit: string;
  inStock: boolean;
  isActive: boolean;
  featured: boolean;
  popular: boolean;
  promoPct: number | null;
  promoEnd: string | null;
  promoType: string | null;
  origin: string;
  freshness: string;
  snoozeType: string;
  snoozeEndsAt: string | null;
  tags: string[];
  createdAt: string;
  shopId: string;
  shop: { id: string; name: string; slug: string };
  category: { id: string; name: string; emoji: string | null };
  labels: { id: string; name: string; color: string | null }[];
  _count: { orderItems: number };
}

interface Stats {
  totalAll: number;
  active: number;
  outOfStock: number;
  promo: number;
  snoozed: number;
}

interface ShopOption {
  id: string;
  name: string;
}

/* ─── helpers ─── */
const fmt = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );

const UNIT_LABELS: Record<string, string> = {
  KG: "/kg",
  PIECE: "/pc",
  BARQUETTE: "/barq.",
  TRANCHE: "/tr.",
};

const ORIGIN_FLAGS: Record<string, string> = {
  FRANCE: "🇫🇷",
  EU: "🇪🇺",
  ESPAGNE: "🇪🇸",
  IRLANDE: "🇮🇪",
  ECOSSE: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  PAYS_BAS: "🇳🇱",
  BELGIQUE: "🇧🇪",
  ALLEMAGNE: "🇩🇪",
  ITALIE: "🇮🇹",
  BRESIL: "🇧🇷",
  ARGENTINE: "🇦🇷",
  AUSTRALIE: "🇦🇺",
  NOUVELLE_ZELANDE: "🇳🇿",
};

const FRESHNESS_LABELS: Record<string, string> = {
  FRAIS: "Frais",
  SURGELE: "Surgelé",
  SOUS_VIDE: "Sous vide",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Plus récent" },
  { value: "name", label: "Nom A→Z" },
  { value: "price_asc", label: "Prix ↑" },
  { value: "price_desc", label: "Prix ↓" },
  { value: "shop", label: "Boutique" },
];

/* ================================================================== */
export default function WebmasterCataloguePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Promote
  const [promoteProduct, setPromoteProduct] = useState<Product | null>(null);
  const [globalCategories, setGlobalCategories] = useState<{ id: string; name: string; emoji: string | null }[]>([]);
  const [promoteCatId, setPromoteCatId] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [shopId, setShopId] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [promoFilter, setPromoFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  /* ── fetch shops for filter dropdown ── */
  useEffect(() => {
    fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const list = d.data
            .map((s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            }))
            .sort((a: ShopOption, b: ShopOption) => a.name.localeCompare(b.name));
          setShops(list);
        }
      })
      .catch(() => {});
  }, []);

  /* ── fetch products ── */
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", "30");
    if (search) params.set("search", search);
    if (shopId) params.set("shopId", shopId);
    if (stockFilter) params.set("stock", stockFilter);
    if (activeFilter) params.set("active", activeFilter);
    if (promoFilter) params.set("promo", promoFilter);
    params.set("sort", sortBy);

    try {
      const res = await fetch(`/api/webmaster/products?${params}`);
      const d = await res.json();
      if (d.success) {
        setProducts(d.data.products);
        setTotal(d.data.total);
        setTotalPages(d.data.totalPages);
        setStats(d.data.stats);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, search, shopId, stockFilter, activeFilter, promoFilter, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ── reset page when filters change ── */
  useEffect(() => {
    setPage(1);
  }, [search, shopId, stockFilter, activeFilter, promoFilter, sortBy]);

  /* ── toggle visibility ── */
  const toggleActive = async (product: Product) => {
    const prev = product.isActive;
    setProducts((ps) =>
      ps.map((p) => (p.id === product.id ? { ...p, isActive: !prev } : p))
    );
    try {
      const res = await fetch(`/api/products/${product.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !prev }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setProducts((ps) =>
        ps.map((p) => (p.id === product.id ? { ...p, isActive: prev } : p))
      );
    }
  };

  /* ── clear all filters ── */
  const clearFilters = () => {
    setSearch("");
    setShopId("");
    setStockFilter("");
    setActiveFilter("");
    setPromoFilter("");
    setSortBy("newest");
  };

  /* ── open promote dialog ── */
  const openPromote = async (product: Product) => {
    setPromoteProduct(product);
    setPromoteCatId("");
    setPromoteResult(null);
    if (globalCategories.length === 0) {
      try {
        const res = await fetch("/api/webmaster/catalog/categories");
        const d = await res.json();
        if (d.success) setGlobalCategories(d.data);
      } catch { /* ignore */ }
    }
  };

  const handlePromote = async () => {
    if (!promoteProduct || !promoteCatId) return;
    setPromoting(true);
    setPromoteResult(null);
    try {
      const res = await fetch("/api/webmaster/catalog/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: promoteProduct.id, categoryId: promoteCatId }),
      });
      const d = await res.json();
      if (d.success) {
        setPromoteResult("ok");
        setTimeout(() => { setPromoteProduct(null); setPromoteResult(null); }, 1500);
      } else {
        setPromoteResult(d.error?.message || "Erreur");
      }
    } catch {
      setPromoteResult("Erreur reseau");
    } finally {
      setPromoting(false);
    }
  };

  const hasFilters =
    search || shopId || stockFilter || activeFilter || promoFilter || sortBy !== "newest";

  /* ── stat pills ── */
  const statPills = stats
    ? [
        { label: "Total", value: stats.totalAll, color: "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300" },
        { label: "Actifs", value: stats.active, color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
        { label: "Rupture", value: stats.outOfStock, color: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400" },
        { label: "Promo", value: stats.promo, color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" },
        { label: "Snooze", value: stats.snoozed, color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" },
      ]
    : [];

  /* ── Stock filter pills ── */
  const stockPills = [
    { value: "", label: "Tous" },
    { value: "in", label: "En stock" },
    { value: "out", label: "Rupture" },
    { value: "snoozed", label: "En pause" },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package size={20} /> Catalogue
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Vue globale de tous les produits de la plateforme
          </p>
        </div>
      </div>

      {/* Stats pills */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          {statPills.map((s) => (
            <div
              key={s.label}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${s.color}`}
            >
              {s.label} : {s.value}
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters bar */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-3">
        <div className="flex flex-col md:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Rechercher produit, boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="pl-8 pr-8 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition ${
              showFilters || hasFilters
                ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400"
                : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
            }`}
          >
            <Filter size={14} />
            Filtres
            {hasFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
            >
              <X size={14} /> Effacer
            </button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06] flex flex-col md:flex-row gap-3">
            {/* Shop filter */}
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Boutique
              </label>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="">Toutes les boutiques</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Active filter */}
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Visibilite
              </label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="">Tous</option>
                <option value="yes">Visible</option>
                <option value="no">Masqué</option>
              </select>
            </div>

            {/* Promo filter */}
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Promo
              </label>
              <select
                value={promoFilter}
                onChange={(e) => setPromoFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="">Tous</option>
                <option value="yes">En promo</option>
              </select>
            </div>
          </div>
        )}

        {/* Stock filter pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {stockPills.map((pill) => (
            <button
              key={pill.value}
              onClick={() => setStockFilter(pill.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                stockFilter === pill.value
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {total} produit{total !== 1 ? "s" : ""} trouvé{total !== 1 ? "s" : ""}
        </span>
        <span>
          Page {page}/{totalPages || 1}
        </span>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] animate-pulse"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-12 text-center">
          <Package size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Aucun produit trouvé avec ces filtres.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onToggleActive={toggleActive}
              onPromote={openPromote}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-xl text-xs font-medium transition ${
                  page === pageNum
                    ? "bg-red-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {/* Promote dialog */}
      {promoteProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPromoteProduct(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-display font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ArrowUpRight size={18} className="text-red-600" />
              Promouvoir au catalogue
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ajouter <strong>{promoteProduct.name}</strong> ({promoteProduct.shop.name}) au catalogue de reference.
            </p>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                Categorie globale *
              </label>
              <select
                value={promoteCatId}
                onChange={(e) => setPromoteCatId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="">Choisir une categorie...</option>
                {globalCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji || ""} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {promoteResult && promoteResult !== "ok" && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{promoteResult}</p>
            )}

            {promoteResult === "ok" ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600 py-2">
                <CheckCircle size={18} /> Produit promu avec succes
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setPromoteProduct(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handlePromote}
                  disabled={!promoteCatId || promoting}
                  className="flex-1 px-4 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                >
                  {promoting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                  Promouvoir
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* ── Product Card ─── */
/* ================================================================== */
function ProductCard({
  product,
  onToggleActive,
  onPromote,
}: {
  product: Product;
  onToggleActive: (p: Product) => void;
  onPromote: (p: Product) => void;
}) {
  const promoPrice = product.promoPct
    ? Math.round(product.priceCents * (1 - product.promoPct / 100))
    : null;

  const stockBadge = !product.inStock
    ? { label: "Rupture", cls: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" }
    : product.snoozeType !== "NONE"
      ? { label: "En pause", cls: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" }
      : null;

  return (
    <div
      className={`bg-white dark:bg-[#141414] rounded-2xl border shadow-sm transition ${
        !product.isActive
          ? "border-gray-200 dark:border-white/[0.04] opacity-60"
          : "border-gray-200 dark:border-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Image */}
        <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-white/5 flex-shrink-0 overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">
              {product.category?.emoji || "🥩"}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {product.name}
            </h3>
            {product.popular && (
              <Flame size={12} className="text-orange-500 flex-shrink-0" />
            )}
            {product.featured && (
              <Star size={12} className="text-amber-500 flex-shrink-0" />
            )}
            {product.promoPct && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-red-600 text-white flex-shrink-0">
                -{product.promoPct}%
              </span>
            )}
            {stockBadge && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${stockBadge.cls} flex-shrink-0`}
              >
                {stockBadge.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Store size={11} />
              {product.shop.name}
            </span>
            <span>·</span>
            <span>
              {product.category?.emoji} {product.category?.name}
            </span>
            {product.origin && ORIGIN_FLAGS[product.origin] && (
              <>
                <span>·</span>
                <span>{ORIGIN_FLAGS[product.origin]}</span>
              </>
            )}
            {product.freshness && product.freshness !== "FRAIS" && (
              <>
                <span>·</span>
                <span>{FRESHNESS_LABELS[product.freshness]}</span>
              </>
            )}
          </div>

          {/* Labels */}
          {product.labels.length > 0 && (
            <div className="flex gap-1 mt-1">
              {product.labels.map((l) => (
                <span
                  key={l.id}
                  className="px-1.5 py-0.5 text-[10px] rounded-md bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                  style={l.color ? { backgroundColor: l.color + "20", color: l.color } : {}}
                >
                  {l.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side: price + actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Price */}
          <div className="text-right">
            {promoPrice ? (
              <>
                <span className="text-xs text-gray-400 line-through">
                  {fmt(product.priceCents)}
                </span>
                <div className="text-sm font-bold text-red-600">
                  {fmt(promoPrice)}
                  <span className="text-[10px] font-normal text-gray-400">
                    {UNIT_LABELS[product.unit] || ""}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {fmt(product.priceCents)}
                <span className="text-[10px] font-normal text-gray-400">
                  {UNIT_LABELS[product.unit] || ""}
                </span>
              </div>
            )}
            {product.proPriceCents && (
              <div className="text-[10px] text-blue-600 dark:text-blue-400">
                PRO {fmt(product.proPriceCents)}
              </div>
            )}
          </div>

          {/* Order count */}
          <div className="text-center px-2">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {product._count.orderItems}
            </div>
            <div className="text-[10px] text-gray-400">ventes</div>
          </div>

          {/* Toggle visibility */}
          <button
            onClick={() => onToggleActive(product)}
            className={`p-2 rounded-xl transition ${
              product.isActive
                ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                : "text-gray-400 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
            title={product.isActive ? "Masquer le produit" : "Rendre visible"}
          >
            {product.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>

          {/* Promote to reference */}
          <button
            onClick={() => onPromote(product)}
            className="p-2 rounded-xl text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition"
            title="Promouvoir au catalogue reference"
          >
            <ArrowUpRight size={16} />
          </button>

          {/* Link to shop */}
          <a
            href={`/webmaster/boutiques/${product.shopId}`}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition"
            title="Voir la boutique"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
