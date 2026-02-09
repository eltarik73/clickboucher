"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Package,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Category = {
  id: string;
  name: string;
  order: number;
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
  promoPct: number | null;
  promoEnd: string | null;
  category: Category;
};

type Shop = {
  id: string;
  name: string;
  categories: Category[];
};

const TAG_COLORS: Record<string, string> = {
  Halal: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
  Bio: "bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-950/30 dark:text-lime-300 dark:border-lime-800",
  Nouveau: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
  Promo: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
};

const UNIT_LABELS: Record<string, string> = {
  KG: "/kg",
  PIECE: "/pc",
  BARQUETTE: "/barq.",
};

const AVAILABLE_TAGS = ["Halal", "Bio", "Nouveau"];

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function BoucherProduitsPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // Add form
  const [showForm, setShowForm] = useState(false);

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
    // Optimistic update
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
        // Revert on error
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, inStock: !newInStock } : p))
        );
      }
    } catch {
      // Revert
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, inStock: !newInStock } : p))
      );
    }
  }

  // ── Filter products ──
  const filtered = products.filter((p) => {
    if (selectedCategory && p.categoryId !== selectedCategory) return false;
    if (showOutOfStock && p.inStock) return false;
    return true;
  });

  // Group by category
  const categories = shop?.categories || [];
  const grouped = categories
    .map((cat) => ({
      category: cat,
      items: filtered.filter((p) => p.categoryId === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8b2500]" />
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

  const inStockCount = products.filter((p) => p.inStock).length;
  const outCount = products.length - inStockCount;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#1a1814]">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-[#f8f6f3]">Mes produits</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {inStockCount} en stock · {outCount} en rupture
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#8b2500] hover:bg-[#6d1d00] gap-1.5"
          >
            <Plus size={16} /> Ajouter
          </Button>
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              !selectedCategory
                ? "bg-[#8b2500] text-white"
                : "bg-white dark:bg-[#2a2520] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3530] border border-gray-200 dark:border-[#3a3530]"
            }`}
          >
            Tous ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? "bg-[#8b2500] text-white"
                    : "bg-white dark:bg-[#2a2520] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3530] border border-gray-200 dark:border-[#3a3530]"
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
          <button
            onClick={() => setShowOutOfStock(!showOutOfStock)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              showOutOfStock
                ? "bg-red-600 text-white"
                : "bg-white dark:bg-[#2a2520] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3530] border border-gray-200 dark:border-[#3a3530]"
            }`}
          >
            En rupture ({outCount})
          </button>
        </div>

        {/* ── Product list ── */}
        {grouped.length === 0 ? (
          <Card className="bg-white dark:bg-[#2a2520] border-0 shadow-sm">
            <CardContent className="py-12 flex flex-col items-center gap-2">
              <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Aucun produit trouvé</p>
            </CardContent>
          </Card>
        ) : (
          grouped.map((group) => (
            <div key={group.category.id} className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                {group.category.name}
              </h2>
              {group.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onToggleStock={() => toggleStock(product)}
                />
              ))}
            </div>
          ))
        )}

        {/* ── Add form modal ── */}
        {showForm && shop && (
          <AddProductForm
            shopId={shop.id}
            categories={categories}
            onClose={() => setShowForm(false)}
            onCreated={() => { setShowForm(false); fetchData(); }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────
function ProductCard({
  product,
  onToggleStock,
}: {
  product: Product;
  onToggleStock: () => void;
}) {
  const hasPromo = product.promoPct && product.promoPct > 0;
  const promoActive = hasPromo && product.promoEnd && new Date(product.promoEnd) > new Date();

  return (
    <Card className={`bg-white dark:bg-[#2a2520] border-0 shadow-sm transition-opacity ${!product.inStock ? "opacity-60" : ""}`}>
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Image */}
          <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1a1814] shrink-0">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="60px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={20} className="text-gray-300 dark:text-gray-600" />
              </div>
            )}
            {promoActive && (
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-bl-lg">
                -{product.promoPct}%
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-[#f8f6f3] truncate">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">
                    {(product.priceCents / 100).toFixed(2).replace(".", ",")} €
                    <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                      {UNIT_LABELS[product.unit] || ""}
                    </span>
                  </span>
                  {product.proPriceCents != null && (
                    <span className="text-xs text-[#8b2500] dark:text-[#c4593e] font-medium">
                      {(product.proPriceCents / 100).toFixed(2).replace(".", ",")} € Pro
                    </span>
                  )}
                </div>
              </div>

              {/* Stock toggle */}
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <Switch
                  checked={product.inStock}
                  onCheckedChange={onToggleStock}
                  className={product.inStock ? "!bg-emerald-500" : "!bg-red-400"}
                />
                <span className={`text-[10px] font-medium ${product.inStock ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                  {product.inStock ? "En stock" : "Rupture"}
                </span>
              </div>
            </div>

            {/* Tags & category */}
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] border-gray-200 dark:border-[#3a3530] text-gray-500 dark:text-gray-400">
                {product.category.name}
              </Badge>
              {product.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={`text-[10px] border ${TAG_COLORS[tag] || "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}`}
                >
                  {tag}
                </Badge>
              ))}
              {promoActive && product.promoEnd && (
                <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-600 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
                  Promo jusqu&apos;au {new Date(product.promoEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Add Product Form (Modal overlay)
// ─────────────────────────────────────────────
function AddProductForm({
  shopId,
  categories,
  onClose,
  onCreated,
}: {
  shopId: string;
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [proPrice, setProPrice] = useState("");
  const [unit, setUnit] = useState<"KG" | "PIECE" | "BARQUETTE">("KG");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    const next = new Set(tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setTags(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !price) {
      setFormError("Nom et prix requis");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        priceCents: Math.round(parseFloat(price) * 100),
        unit,
        categoryId,
        shopId,
        tags: [...tags],
      };
      if (description.trim()) body.description = description.trim();
      if (proPrice) body.proPriceCents = Math.round(parseFloat(proPrice) * 100);
      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onCreated();
      } else {
        const json = await res.json();
        setFormError(json.error?.message || "Erreur lors de la création");
      }
    } catch {
      setFormError("Erreur de connexion");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#2a2520] rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#2a2520] border-b border-gray-100 dark:border-[#3a3530] px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#f8f6f3]">Nouveau produit</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3a3530] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#4a4540]"
          >
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Nom du produit *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Entrecôte maturée"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du produit..."
              rows={2}
              className="w-full rounded-xl border border-gray-200 dark:border-[#3a3530] bg-white dark:bg-[#1a1814] px-3 py-2 text-sm text-gray-900 dark:text-[#f8f6f3] resize-none focus:outline-none focus:ring-2 focus:ring-[#8b2500]/30 focus:border-[#8b2500]"
            />
          </div>

          {/* Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Prix (€) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="12.50"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Prix Pro (€)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={proPrice}
                onChange={(e) => setProPrice(e.target.value)}
                placeholder="10.00"
              />
            </div>
          </div>

          {/* Unit & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Unité
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as "KG" | "PIECE" | "BARQUETTE")}
                className="w-full h-10 rounded-xl border border-gray-200 dark:border-[#3a3530] bg-white dark:bg-[#1a1814] px-3 text-sm text-gray-900 dark:text-[#f8f6f3] focus:outline-none focus:ring-2 focus:ring-[#8b2500]/30 focus:border-[#8b2500]"
              >
                <option value="KG">Kilogramme (kg)</option>
                <option value="PIECE">Pièce</option>
                <option value="BARQUETTE">Barquette</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Catégorie
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 dark:border-[#3a3530] bg-white dark:bg-[#1a1814] px-3 text-sm text-gray-900 dark:text-[#f8f6f3] focus:outline-none focus:ring-2 focus:ring-[#8b2500]/30 focus:border-[#8b2500]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Tags
            </label>
            <div className="flex gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    tags.has(tag)
                      ? TAG_COLORS[tag] || "bg-gray-200 text-gray-700"
                      : "bg-white dark:bg-[#1a1814] text-gray-400 border-gray-200 dark:border-[#3a3530] hover:bg-gray-50 dark:hover:bg-[#3a3530]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              URL image
            </label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>

          {/* Error */}
          {formError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#8b2500] hover:bg-[#6d1d00] h-11"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Créer le produit"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
