// src/app/(boucher)/boucher/produits/page.tsx — V2 Product Management Dashboard
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Copy,
  Pencil,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { getFlag, getOriginCountry } from "@/lib/flags";
import { resolveProductImage } from "@/lib/product-images";
import { useNotify } from "@/components/ui/NotificationToast";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  isActive: boolean;
  unitLabel: string | null;
  sliceOptions: { defaultSlices: number; minSlices: number; maxSlices: number; thicknesses: string[] } | null;
  categories: Category[];
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
  TRANCHE: "/kg",
};

type StockFilter = "all" | "inStock" | "outOfStock" | "inactive";

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
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  // Notifications
  const { notify } = useNotify();

  // Drag & drop (dnd-kit with touch support)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

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

  // ── Toggle active (optimistic) ──
  async function toggleActive(product: Product) {
    const newActive = !product.isActive;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isActive: newActive } : p))
    );
    try {
      const res = await fetch(`/api/products/${product.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, isActive: !newActive } : p))
        );
        notify("error", "Erreur lors du changement de visibilité");
      }
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: !newActive } : p))
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

  // ── Drag & drop handler (dnd-kit) ──
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newProducts = arrayMove(products, oldIndex, newIndex);
    setProducts(newProducts);

    // Send to API
    if (shop) {
      const ids = newProducts.map((p) => p.id);
      fetch("/api/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shop.id, productIds: ids }),
      }).catch(() => {
        fetchData();
      });
    }
  }

  // ── Duplicate product ──
  async function duplicateProduct(product: Product) {
    try {
      const res = await fetch("/api/products/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      if (res.ok) {
        notify("success", `"${product.name}" dupliqué`);
        fetchData();
      } else {
        notify("error", "Erreur lors de la duplication");
      }
    } catch {
      notify("error", "Erreur de connexion");
    }
  }

  // ── Category CRUD ──
  const [showCatManager, setShowCatManager] = useState(false);
  const [catName, setCatName] = useState("");
  const [catEmoji, setCatEmoji] = useState("");
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  async function saveCategory() {
    if (!shop || !catName.trim()) return;
    setCatSaving(true);
    try {
      if (editCatId) {
        // Update
        const res = await fetch("/api/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editCatId, name: catName.trim(), emoji: catEmoji.trim() || null }),
        });
        if (res.ok) {
          notify("success", "Categorie modifiee");
          setCatName(""); setCatEmoji(""); setEditCatId(null);
          fetchData();
        } else {
          const json = await res.json();
          notify("error", json.error?.message || "Erreur");
        }
      } else {
        // Create
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId: shop.id, name: catName.trim(), emoji: catEmoji.trim() || null }),
        });
        if (res.ok) {
          notify("success", "Categorie creee");
          setCatName(""); setCatEmoji("");
          fetchData();
        } else {
          const json = await res.json();
          notify("error", json.error?.message || "Erreur");
        }
      }
    } catch {
      notify("error", "Erreur de connexion");
    } finally {
      setCatSaving(false);
    }
  }

  async function deleteCategory(catId: string) {
    try {
      const res = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: catId }),
      });
      if (res.ok) {
        notify("success", "Categorie supprimee");
        fetchData();
      } else {
        const json = await res.json();
        notify("error", json.error?.message || "Erreur");
      }
    } catch {
      notify("error", "Erreur de connexion");
    }
  }

  // ── Filter & sort ──
  const filtered = products.filter((p) => {
    if (selectedCategory && !p.categories.some((c) => c.id === selectedCategory)) return false;
    if (stockFilter === "inStock" && (!p.inStock || !p.isActive)) return false;
    if (stockFilter === "outOfStock" && (p.inStock || !p.isActive)) return false;
    if (stockFilter === "inactive" && p.isActive !== false) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !(p.description || "").toLowerCase().includes(q) &&
        !(p.origin || "").toLowerCase().includes(q) &&
        !p.categories.some((c) => c.name.toLowerCase().includes(q))
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
  const inactiveCount = products.filter((p) => p.isActive === false).length;
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
              onClick={() => router.push("/boucher/produits/nouveau")}
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
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Produits</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{inStockCount}</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">En stock</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">{promoCount}</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Promos</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className={`text-lg font-bold ${snoozedCount > 0 ? "text-orange-400" : "text-white"}`}>{snoozedCount}</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">En pause</p>
            </div>
            <div className="bg-white/10 rounded-xl px-2 py-2.5 text-center">
              <p className={`text-lg font-bold ${outCount > 0 ? "text-red-400" : "text-white"}`}>{outCount}</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Ruptures</p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════ */}
        {/* SEARCH + SORT                          */}
        {/* ══════════════════════════════════════ */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
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
                <X size={10} className="text-gray-500 dark:text-gray-400" />
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
        {/* STOCK FILTER PILLS                     */}
        {/* ══════════════════════════════════════ */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {([
            { key: "all" as StockFilter, label: "Tous", count: totalCount },
            { key: "inStock" as StockFilter, label: "En stock", count: inStockCount },
            { key: "outOfStock" as StockFilter, label: "Rupture", count: outCount },
            { key: "inactive" as StockFilter, label: "Inactifs", count: inactiveCount },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setStockFilter(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all whitespace-nowrap ${
                stockFilter === f.key
                  ? f.key === "inactive"
                    ? "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900"
                    : "bg-[#DC2626] text-white"
                  : "bg-white dark:bg-[#141414] text-gray-500 dark:text-gray-400 border border-[#ece8e3] dark:border-white/10"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════ */}
        {/* CATEGORY PILLS + MANAGE                */}
        {/* ══════════════════════════════════════ */}
        <div className="flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1" style={{ scrollbarWidth: "none" }}>
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
              const count = products.filter((p) => p.categories.some((c) => c.id === cat.id)).length;
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
          <button
            onClick={() => setShowCatManager(!showCatManager)}
            className="shrink-0 p-1.5 rounded-lg bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-[#DC2626] transition-colors"
            title="Gérer les catégories"
          >
            <FolderOpen size={14} />
          </button>
        </div>

        {/* ── Category manager panel ── */}
        {showCatManager && (
          <Card className="bg-white dark:bg-[#141414] border-[#ece8e3] dark:border-white/10 rounded-[14px]">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <FolderOpen size={14} /> Gérer les catégories
              </h3>

              {/* Add / Edit form */}
              <div className="flex gap-2">
                <Input
                  value={catEmoji}
                  onChange={(e) => setCatEmoji(e.target.value)}
                  placeholder="🥩"
                  className="w-14 h-9 text-center"
                  maxLength={4}
                />
                <Input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Nom de la catégorie"
                  className="flex-1 h-9"
                  maxLength={100}
                  onKeyDown={(e) => e.key === "Enter" && saveCategory()}
                />
                <Button
                  onClick={saveCategory}
                  disabled={catSaving || !catName.trim()}
                  size="sm"
                  className="h-9 bg-[#DC2626] hover:bg-[#b91c1c]"
                >
                  {editCatId ? "Modifier" : "Ajouter"}
                </Button>
                {editCatId && (
                  <Button
                    onClick={() => { setEditCatId(null); setCatName(""); setCatEmoji(""); }}
                    variant="ghost"
                    size="sm"
                    className="h-9"
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>

              {/* Category list */}
              <div className="space-y-1">
                {categories.map((cat) => {
                  const count = products.filter((p) => p.categories.some((c) => c.id === cat.id)).length;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5"
                    >
                      <span className="text-sm">{cat.emoji || "📁"}</span>
                      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {cat.name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{count} produit{count > 1 ? "s" : ""}</span>
                      <button
                        onClick={() => { setEditCatId(cat.id); setCatName(cat.name); setCatEmoji(cat.emoji || ""); }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 dark:text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (count > 0) {
                            notify("error", `${count} produit(s) dans cette categorie`);
                            return;
                          }
                          deleteCategory(cat.id);
                        }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 dark:text-gray-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
                {categories.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Aucune categorie</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
            {isDraggable ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sorted.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {sorted.map((product) => (
                    <SortableProductRow
                      key={product.id}
                      product={product}
                      onToggleStock={() => toggleStock(product)}
                      onToggleActive={() => toggleActive(product)}
                      onSnooze={(type) => snoozeProduct(product, type)}
                      onEdit={() => router.push(`/boucher/produits/${product.id}/modifier`)}
                      onDuplicate={() => duplicateProduct(product)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              sorted.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onToggleStock={() => toggleStock(product)}
                  onToggleActive={() => toggleActive(product)}
                  onSnooze={(type) => snoozeProduct(product, type)}
                  onEdit={() => router.push(`/boucher/produits/${product.id}/modifier`)}
                  onDuplicate={() => duplicateProduct(product)}
                  isDraggable={false}
                />
              ))
            )}
          </div>
        )}

        {/* Product form is now at /boucher/produits/nouveau and /boucher/produits/[id]/modifier */}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sortable Product Row wrapper (dnd-kit touch support)
// ─────────────────────────────────────────────
function SortableProductRow({
  product,
  onToggleStock,
  onToggleActive,
  onSnooze,
  onEdit,
  onDuplicate,
}: {
  product: Product;
  onToggleStock: () => void;
  onToggleActive: () => void;
  onSnooze: (type: string) => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ProductRow
        product={product}
        onToggleStock={onToggleStock}
        onToggleActive={onToggleActive}
        onSnooze={onSnooze}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        isDraggable
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Product Row (V2 enriched)
// ─────────────────────────────────────────────
function ProductRow({
  product,
  onToggleStock,
  onToggleActive,
  onSnooze,
  onEdit,
  onDuplicate,
  isDraggable,
  dragHandleProps,
}: {
  product: Product;
  onToggleStock: () => void;
  onToggleActive: () => void;
  onSnooze: (type: string) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  isDraggable: boolean;
  dragHandleProps?: Record<string, unknown>;
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
    if (diff <= 0) return "Bientôt dispo";
    const min = Math.floor(diff / 60000);
    if (min < 60) return `Retour ${min}min`;
    const h = Math.floor(min / 60);
    return h < 24 ? `Retour ${h}h` : "Retour demain";
  }

  // Pick best image — with fallback chain
  const imgSrc = product.images.length > 0
    ? (product.images.find((i) => i.isPrimary) || product.images[0]).url
    : (product.imageUrl || null);

  const SNOOZE_OPTIONS = [
    { type: "ONE_HOUR", label: "1 heure" },
    { type: "TWO_HOURS", label: "2 heures" },
    { type: "END_OF_DAY", label: "Fin de journée" },
    { type: "INDEFINITE", label: "Indéfini" },
  ];

  return (
    <div
      className={`flex items-center gap-2.5 p-3 bg-white dark:bg-[#141414] rounded-[14px] border border-[#ece8e3] dark:border-white/10 transition-all ${
        product.isActive === false ? "opacity-50 bg-gray-50/50 dark:bg-gray-950/10 border-gray-300 dark:border-gray-700" :
        isSnoozed ? "opacity-60 bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-800/30" :
        outOfStock ? "opacity-60 bg-red-50/50 dark:bg-red-950/10" : ""
      }`}
    >
      {/* Drag handle */}
      {isDraggable && (
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 touch-none p-1"
          {...(dragHandleProps || {})}
        >
          <GripVertical size={16} />
        </div>
      )}

      {/* Image / Category emoji */}
      <div className="relative w-[52px] h-[52px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            width={52}
            height={52}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const fallback = resolveProductImage({ name: product.name, imageUrl: null, category: product.categories[0]?.name || "" });
              (e.target as HTMLImageElement).src = fallback;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">
            {product.categories[0]?.emoji || "🥩"}
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
          {product.categories.map((cat, i) => (
            <span key={cat.id} className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              {cat.emoji ? `${cat.emoji} ` : ""}{cat.name}{i < product.categories.length - 1 ? " ·" : ""}
            </span>
          ))}
          {product.origin && (
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              {getFlag(product.origin)} {getOriginCountry(product.origin)}
            </span>
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {product.unit === "KG" ? "Poids" : product.unit === "PIECE" ? "Piece" : product.unit === "TRANCHE" ? "Tranche" : "Barquette"}
          </span>
          {product.isActive === false && (
            <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[8px] font-bold rounded">
              Masqué
            </span>
          )}
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
            <span className="block text-[10px] text-gray-400 dark:text-gray-500 line-through">
              {fmtPrice(product.priceCents)}
            </span>
          </div>
        ) : (
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {fmtPrice(product.priceCents)}
          </span>
        )}
        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">{UNIT_LABELS[product.unit] || ""}</span>
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

        {/* Active toggle + Duplicate */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleActive}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-colors text-[8px] font-semibold ${
              product.isActive !== false
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            title={product.isActive !== false ? "Masquer le produit" : "Rendre visible"}
          >
            <Eye size={9} />
            {product.isActive !== false ? "Visible" : "Masqué"}
          </button>
          <button
            onClick={onDuplicate}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-colors text-[8px] font-semibold bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-900/10"
            title="Dupliquer ce produit"
          >
            <Copy size={9} />
          </button>
        </div>

        {/* Snooze dropdown (Deliveroo style) */}
        {showSnoozeMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowSnoozeMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-[#1a1a1a] border border-[#ece8e3] dark:border-white/10 rounded-xl shadow-lg overflow-hidden min-w-[150px]">
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-white/5">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Mettre en pause</p>
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
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
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

