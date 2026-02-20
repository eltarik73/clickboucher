// src/app/(boucher)/boucher/produits/page.tsx — V2 Product Management Dashboard
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  AlertCircle,
  X,
  Package,
  Search,
  GripVertical,
  ArrowUpDown,
  ChevronDown,
  Timer,
  Eye,
} from "lucide-react";
import { getFlag, getOriginCountry } from "@/lib/flags";
import { ProductForm, type EditProduct } from "./ProductForm";
import { useNotify } from "@/components/ui/NotificationToast";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Category = {
  id: string;
  name: string;
  emoji: string | null;
  order: number;
};

type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  order: number;
  isPrimary: boolean;
};

type ProductLabel = {
  id: string;
  name: string;
  color: string | null;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  proPriceCents: number | null;
  unit: string;
  inStock: boolean;
  stockQty: number | null;
  categoryId: string;
  shopId: string;
  tags: string[];
  displayOrder: number;
  popular: boolean;
  origin: string | null;
  halalOrg: string | null;
  race: string | null;
  freshness: string | null;
  promoPct: number | null;
  promoEnd: string | null;
  promoType: string | null;
  snoozeType: string;
  snoozedAt: string | null;
  snoozeEndsAt: string | null;
  snoozeReason: string | null;
  category: Category;
  images: ProductImage[];
  labels: ProductLabel[];
};

type Shop = {
  id: string;
  name: string;
  categories: Category[];
};

type SortMode = "custom" | "name" | "price" | "date";

const UNIT_LABELS: Record<string, string> = {
  KG: "/kg",
  PIECE: "/pce",
  BARQUETTE: "/barq.",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#141414] rounded-[14px] border border-[#ece8e3] dark:border-white/10 animate-pulse">
      <div className="w-5 h-8 bg-gray-200 dark:bg-white/10 rounded" />
      <div className="w-[52px] h-[52px] bg-gray-200 dark:bg-white/10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="h-3 w-1/2 bg-gray-100 dark:bg-white/5 rounded" />
      </div>
      <div className="w-16 h-5 bg-gray-200 dark:bg-white/10 rounded" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function BoucherProduitsPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<EditProduct | null>(null);

  // Notifications
  const { notify } = useNotify();

  // Drag & drop
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    try {
      const shopRes = await fetch("/api/shops/my-shop");
      if (!shopRes.ok) {
        setError("Impossible de charger votre boucherie");
        return;
      }
      const shopJson = await shopRes.json();
      const shopData: Shop = shopJson.data;
      setShop(shopData);

      const productsRes = await fetch(`/api/products?shopId=${shopData.id}`);
      if (productsRes.ok) {
        const productsJson = await productsRes.json();
        setProducts(productsJson.data || []);
      }
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Toggle stock (optimistic) ──
  async function toggleStock(product: Product) {
    const newInStock = !product.inStock;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, inStock: newInStock } : p))
    );

    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inStock: newInStock }),
      });
      if (!res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, inStock: !newInStock } : p))
        );
        notify("error", "Erreur lors du changement de stock");
      }
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, inStock: !newInStock } : p))
      );
      notify("error", "Erreur de connexion au serveur");
    }
  }

  // ── Snooze product (Deliveroo style) ──
  async function snoozeProduct(product: Product, type: string) {
    // Optimistic
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? { ...p, snoozeType: type, inStock: type === "NONE" }
          : p
      )
    );

    try {
      const res = await fetch(`/api/boucher/products/${product.id}/snooze`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const json = await res.json();
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? { ...p, ...json.data }
              : p
          )
        );
      } else {
        notify("error", "Erreur lors de la mise en pause");
        fetchData();
      }
    } catch {
      notify("error", "Erreur de connexion au serveur");
      fetchData();
    }
  }

  // ── Drag & drop handlers ──
  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  function handleDragEnd() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }

    // Reorder the filtered list
    const newProducts = [...products];
    const [moved] = newProducts.splice(dragIdx, 1);
    newProducts.splice(overIdx, 0, moved);
    setProducts(newProducts);
    setDragIdx(null);
    setOverIdx(null);

    // Send to API
    if (shop) {
      const ids = newProducts.map((p) => p.id);
      fetch("/api/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shop.id, productIds: ids }),
      }).catch(() => {
        // Revert on error — refetch
        fetchData();
      });
    }
  }

  // ── Filter & sort ──
  const filtered = products.filter((p) => {
    if (selectedCategory && p.categoryId !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !(p.description || "").toLowerCase().includes(q) &&
        !(p.origin || "").toLowerCase().includes(q) &&
        !p.category.name.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case "name":
        return a.name.localeCompare(b.name, "fr");
      case "price":
        return a.priceCents - b.priceCents;
      case "date":
        return b.displayOrder - a.displayOrder; // Newer = higher order
      default: // custom
        return 0; // Keep original order
    }
  });

  // ── Stats ──
  const totalCount = products.length;
  const inStockCount = products.filter((p) => p.inStock && p.snoozeType === "NONE").length;
  const snoozedCount = products.filter((p) => p.snoozeType !== "NONE").length;
  const outCount = products.filter((p) => !p.inStock && p.snoozeType === "NONE").length;
  const promoCount = products.filter(
    (p) => p.promoPct && p.promoPct > 0 && (!p.promoEnd || new Date(p.promoEnd) > new Date())
  ).length;

  const categories = shop?.categories || [];

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">
          <div className="h-28 bg-gradient-to-r from-[#1A1A1A] to-[#2D2D2D] rounded-[14px] animate-pulse" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-white/10 rounded-full animate-pulse" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{error}</p>
      </div>
    );
  }

  const SORT_LABELS: Record<SortMode, string> = {
    custom: "Ordre perso",
    name: "Nom A-Z",
    price: "Prix croissant",
    date: "Date ajout",
  };

  const isDraggable = sortMode === "custom" && !searchQuery && !selectedCategory;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════════════════════════════════ */}
        {/* HEADER with stats                      */}
        {/* ══════════════════════════════════════ */}
        <div className="bg-gradient-to-r from-[#1A1A1A] to-[#2D2D2D] rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white">Mes Produits</h1>
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              className="bg-[#DC2626] hover:bg-[#b91c1c] gap-1.5 h-9"
            >
              <Plus size={15} /> Ajouter
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-white">{totalCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">Produits</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{inStockCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">En stock</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">{promoCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">Promos</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className={`text-lg font-bold ${snoozedCount > 0 ? "text-orange-400" : "text-white"}`}>{snoozedCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">En pause</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className={`text-lg font-bold ${outCount > 0 ? "text-red-400" : "text-white"}`}>{outCount}</p>
              <p className="text-[9px] text-gray-400 font-medium">Ruptures</p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════ */}
        {/* SEARCH + SORT                          */}
        {/* ══════════════════════════════════════ */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit..."
              className="pl-9 h-9 bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10 rounded-xl text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center"
              >
                <X size={10} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="h-9 gap-1.5 bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400 rounded-xl"
            >
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline text-xs">{SORT_LABELS[sortMode]}</span>
              <ChevronDown size={12} />
            </Button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-[#1a1a1a] border border-[#ece8e3] dark:border-white/10 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
                  {(["custom", "name", "price", "date"] as SortMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                        sortMode === mode
                          ? "bg-[#DC2626]/10 text-[#DC2626]"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      {SORT_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════ */}
        {/* CATEGORY PILLS                         */}
        {/* ══════════════════════════════════════ */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              !selectedCategory
                ? "bg-[#2A2018] dark:bg-white text-white dark:text-[#0a0a0a]"
                : "bg-white dark:bg-[#141414] text-gray-500 dark:text-gray-400 border border-[#ece8e3] dark:border-white/10"
            }`}
          >
            Tous ({totalCount})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? "bg-[#2A2018] dark:bg-white text-white dark:text-[#0a0a0a]"
                    : "bg-white dark:bg-[#141414] text-gray-500 dark:text-gray-400 border border-[#ece8e3] dark:border-white/10"
                }`}
              >
                {cat.emoji ? `${cat.emoji} ` : ""}{cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════ */}
        {/* PRODUCT LIST                           */}
        {/* ══════════════════════════════════════ */}
        {sorted.length === 0 ? (
          <Card className="bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10 rounded-[14px]">
            <CardContent className="py-12 flex flex-col items-center gap-2">
              <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Aucun produit trouvé</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-[#DC2626] font-medium hover:underline mt-1"
                >
                  Effacer la recherche
                </button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {isDraggable && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 px-1">
                Glissez-déposez pour réorganiser l&apos;ordre d&apos;affichage
              </p>
            )}
            {sorted.map((product, idx) => (
              <div
                key={product.id}
                draggable={isDraggable}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`transition-all ${
                  dragIdx === idx ? "opacity-50 scale-[0.98]" : ""
                } ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "border-t-2 border-[#DC2626]" : ""}`}
              >
                <ProductRow
                  product={product}
                  onToggleStock={() => toggleStock(product)}
                  onSnooze={(type) => snoozeProduct(product, type)}
                  onEdit={() => { setEditProduct(product as unknown as EditProduct); setShowForm(true); }}
                  isDraggable={isDraggable}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Product form (add / edit) ── */}
        {showForm && shop && (
          <ProductForm
            shopId={shop.id}
            categories={categories}
            product={editProduct}
            onClose={() => { setShowForm(false); setEditProduct(null); }}
            onSaved={() => { setShowForm(false); setEditProduct(null); fetchData(); }}
            onDeleted={() => { setShowForm(false); setEditProduct(null); fetchData(); }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Product Row (V2 enriched)
// ─────────────────────────────────────────────
function ProductRow({
  product,
  onToggleStock,
  onSnooze,
  onEdit,
  isDraggable,
}: {
  product: Product;
  onToggleStock: () => void;
  onSnooze: (type: string) => void;
  onEdit: () => void;
  isDraggable: boolean;
}) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const hasPromo = product.promoPct != null && product.promoPct > 0;
  const promoActive = hasPromo && (!product.promoEnd || new Date(product.promoEnd) > new Date());
  const isFlash = product.promoType === "FLASH" && promoActive;
  const isSnoozed = product.snoozeType !== "NONE";
  const outOfStock = !product.inStock && !isSnoozed;

  // Snooze badge text
  function snoozeLabel(): string {
    if (!isSnoozed) return "";
    if (product.snoozeType === "INDEFINITE" || !product.snoozeEndsAt) return "Indisponible";
    const diff = new Date(product.snoozeEndsAt).getTime() - Date.now();
    if (diff <= 0) return "Bientot dispo";
    const min = Math.floor(diff / 60000);
    if (min < 60) return `Retour ${min}min`;
    const h = Math.floor(min / 60);
    return h < 24 ? `Retour ${h}h` : "Retour demain";
  }

  // Pick best image
  const imgSrc = product.images.length > 0
    ? (product.images.find((i) => i.isPrimary) || product.images[0]).url
    : product.imageUrl;

  const SNOOZE_OPTIONS = [
    { type: "ONE_HOUR", label: "1 heure" },
    { type: "TWO_HOURS", label: "2 heures" },
    { type: "END_OF_DAY", label: "Fin de journee" },
    { type: "INDEFINITE", label: "Indefini" },
  ];

  return (
    <div
      className={`flex items-center gap-2.5 p-3 bg-white dark:bg-[#141414] rounded-[14px] border border-[#ece8e3] dark:border-white/10 transition-all ${
        isSnoozed ? "opacity-60 bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-800/30" :
        outOfStock ? "opacity-60 bg-red-50/50 dark:bg-red-950/10" : ""
      }`}
    >
      {/* Drag handle */}
      {isDraggable && (
        <div className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 touch-none">
          <GripVertical size={16} />
        </div>
      )}

      {/* Image / Category emoji */}
      <div className="relative w-[52px] h-[52px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">
            {product.category.emoji || "🥩"}
          </div>
        )}
        {promoActive && (
          <div className={`absolute top-0 right-0 text-white text-[8px] font-bold px-1 py-0.5 rounded-bl-lg ${
            isFlash ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-[#DC2626]"
          }`}>
            -{product.promoPct}%
          </div>
        )}
        {isSnoozed && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Timer size={16} className="text-white" />
          </div>
        )}
      </div>

      {/* Info (clickable to edit) */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {product.name}
          </h3>
          {product.popular && (
            <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-bold rounded uppercase">
              Pop
            </span>
          )}
        </div>

        {/* Snooze badge */}
        {isSnoozed && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-[8px] font-bold rounded">
              <Timer size={8} /> {snoozeLabel()}
            </span>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
            {product.category.emoji ? `${product.category.emoji} ` : ""}{product.category.name}
          </span>
          {product.origin && (
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              {getFlag(product.origin)} {getOriginCountry(product.origin)}
            </span>
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {product.unit === "KG" ? "Poids" : product.unit === "PIECE" ? "Piece" : "Barquette"}
          </span>
        </div>

        {/* Labels + halal */}
        {(product.labels.length > 0 || product.halalOrg) && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {product.halalOrg && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded text-[8px] font-semibold text-emerald-700 dark:text-emerald-300">
                {product.halalOrg}
              </span>
            )}
            {product.labels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: label.color ? `${label.color}15` : "#f3f4f6",
                  color: label.color || "#6b7280",
                  border: `1px solid ${label.color ? `${label.color}30` : "#e5e7eb"}`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price */}
      <div className="shrink-0 text-right mr-1">
        {promoActive ? (
          <div>
            <span className="text-sm font-bold text-[#DC2626]">
              {fmtPrice(Math.round(product.priceCents * (1 - (product.promoPct || 0) / 100)))}
            </span>
            <span className="block text-[10px] text-gray-400 line-through">
              {fmtPrice(product.priceCents)}
            </span>
          </div>
        ) : (
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {fmtPrice(product.priceCents)}
          </span>
        )}
        <span className="text-[9px] text-gray-400 font-medium">{UNIT_LABELS[product.unit] || ""}</span>
      </div>

      {/* Stock / Snooze controls */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 relative">
        {isSnoozed ? (
          <button
            onClick={() => onSnooze("NONE")}
            className="flex items-center gap-1 px-2 py-1.5 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 rounded-lg transition-colors"
          >
            <Eye size={12} className="text-orange-600" />
            <span className="text-[9px] font-semibold text-orange-700 dark:text-orange-300">Remettre</span>
          </button>
        ) : (
          <>
            <Switch
              checked={product.inStock}
              onCheckedChange={() => {
                if (product.inStock) {
                  setShowSnoozeMenu(true);
                } else {
                  onToggleStock();
                }
              }}
              className={product.inStock ? "!bg-emerald-500" : "!bg-red-400"}
            />
            <span className={`text-[9px] font-medium ${product.inStock ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {product.inStock ? "Dispo" : "Rupture"}
            </span>
          </>
        )}

        {/* Snooze dropdown (Deliveroo style) */}
        {showSnoozeMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowSnoozeMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-[#1a1a1a] border border-[#ece8e3] dark:border-white/10 rounded-xl shadow-lg overflow-hidden min-w-[150px]">
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-white/5">
                <p className="text-[10px] font-semibold text-gray-500">Mettre en pause</p>
              </div>
              {SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { onSnooze(opt.type); setShowSnoozeMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2"
                >
                  <Timer size={11} className="text-orange-500" />
                  {opt.label}
                </button>
              ))}
              <div className="border-t border-gray-100 dark:border-white/5">
                <button
                  onClick={() => { onToggleStock(); setShowSnoozeMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                >
                  <X size={11} />
                  Rupture de stock
                </button>
              </div>
              <div className="border-t border-gray-100 dark:border-white/5">
                <button
                  onClick={() => setShowSnoozeMenu(false)}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Annuler
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

