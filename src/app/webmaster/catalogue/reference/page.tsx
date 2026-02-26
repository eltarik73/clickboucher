"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";

interface GlobalCategory {
  id: string;
  name: string;
  emoji: string | null;
  order: number;
  _count?: { products: number };
}

interface ReferenceProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  suggestedPrice: number | null;
  unit: string;
  categoryId: string;
  category: GlobalCategory;
  origin: string | null;
  pricePerKg: number | null;
  tags: string[];
  isActive: boolean;
}

const UNIT_LABELS: Record<string, string> = {
  KG: "/kg",
  PIECE: "/pièce",
  BARQUETTE: "/barq.",
  TRANCHE: "/tr.",
};

const ORIGINS = [
  { value: "FRANCE", label: "France", flag: "🇫🇷" },
  { value: "EU", label: "Union Européenne", flag: "🇪🇺" },
  { value: "ESPAGNE", label: "Espagne", flag: "🇪🇸" },
  { value: "IRLANDE", label: "Irlande", flag: "🇮🇪" },
  { value: "BELGIQUE", label: "Belgique", flag: "🇧🇪" },
  { value: "ALLEMAGNE", label: "Allemagne", flag: "🇩🇪" },
  { value: "NOUVELLE_ZELANDE", label: "Nouvelle-Zélande", flag: "🇳🇿" },
  { value: "BRESIL", label: "Brésil", flag: "🇧🇷" },
  { value: "POLOGNE", label: "Pologne", flag: "🇵🇱" },
  { value: "ITALIE", label: "Italie", flag: "🇮🇹" },
  { value: "UK", label: "Royaume-Uni", flag: "🇬🇧" },
  { value: "AUTRE", label: "Autre", flag: "🌍" },
];

const ORIGIN_FLAGS: Record<string, string> = Object.fromEntries(
  ORIGINS.map((o) => [o.value, o.flag])
);

function fmt(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default function ReferenceCatalogPage() {
  const [products, setProducts] = useState<ReferenceProduct[]>([]);
  const [categories, setCategories] = useState<GlobalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ReferenceProduct | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    suggestedPrice: "",
    unit: "KG",
    categoryId: "",
    origin: "FRANCE",
    tags: "",
    isActive: true,
  });
  const [catForm, setCatForm] = useState({ name: "", emoji: "", order: "0" });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/webmaster/catalog/categories");
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("categoryId", categoryFilter);

      const res = await fetch(`/api/webmaster/catalog/reference?${params}`);
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [page, search, categoryFilter]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function openCreate() {
    setEditingProduct(null);
    setForm({
      name: "",
      description: "",
      imageUrl: "",
      suggestedPrice: "",
      unit: "KG",
      categoryId: categories[0]?.id || "",
      origin: "FRANCE",
      tags: "",
      isActive: true,
    });
    setShowModal(true);
  }

  function openEdit(p: ReferenceProduct) {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || "",
      imageUrl: p.imageUrl || "",
      suggestedPrice: p.suggestedPrice ? String(p.suggestedPrice) : "",
      unit: p.unit,
      categoryId: p.categoryId,
      origin: p.origin || "FRANCE",
      tags: p.tags.join(", "),
      isActive: p.isActive,
    });
    setShowModal(true);
  }

  async function handleSave() {
    const body: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      suggestedPrice: form.suggestedPrice ? parseInt(form.suggestedPrice) : undefined,
      unit: form.unit,
      categoryId: form.categoryId,
      origin: form.origin || undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      isActive: form.isActive,
    };

    const url = editingProduct
      ? `/api/webmaster/catalog/reference/${editingProduct.id}`
      : "/api/webmaster/catalog/reference";
    const method = editingProduct ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowModal(false);
      fetchProducts();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce produit de référence ?")) return;
    const res = await fetch(`/api/webmaster/catalog/reference/${id}`, { method: "DELETE" });
    if (res.ok) fetchProducts();
  }

  async function handleToggleActive(p: ReferenceProduct) {
    await fetch(`/api/webmaster/catalog/reference/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchProducts();
  }

  async function handleCreateCategory() {
    const body = {
      name: catForm.name,
      emoji: catForm.emoji || undefined,
      order: parseInt(catForm.order) || 0,
    };
    const res = await fetch("/api/webmaster/catalog/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowCategoryModal(false);
      setCatForm({ name: "", emoji: "", order: "0" });
      fetchCategories();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            Catalogue de Référence
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Produits de référence que les bouchers peuvent importer dans leur catalogue
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/15 transition-colors"
          >
            <Plus size={16} />
            Catégorie
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#DC2626] text-white rounded-xl text-sm font-bold hover:bg-[#b91c1c] transition-colors"
          >
            <Plus size={16} />
            Produit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-[#DC2626]/30 outline-none"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-sm appearance-none cursor-pointer"
          >
            <option value="">Toutes catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name} ({c._count?.products || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Categories pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCategoryFilter(categoryFilter === c.id ? "" : c.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === c.id
                  ? "bg-[#DC2626] text-white"
                  : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15"
              }`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Products list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Aucun produit de référence</p>
          <button onClick={openCreate} className="mt-4 text-[#DC2626] text-sm font-medium hover:underline">
            Créer le premier
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-4 p-4 bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 ${
                !p.isActive ? "opacity-50" : ""
              }`}
            >
              {/* Image */}
              <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-white/10 overflow-hidden flex-shrink-0">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package size={20} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-[#f8f6f3] truncate">
                    {p.name}
                  </span>
                  {p.origin && (
                    <span className="text-sm" title={p.origin}>
                      {ORIGIN_FLAGS[p.origin] || "🌍"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400">
                    {p.category.emoji} {p.category.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {p.unit}
                  </span>
                  {p.tags.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[#DC2626]/10 text-[#DC2626] font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="text-right">
                {p.suggestedPrice ? (
                  <span className="font-bold text-gray-900 dark:text-[#f8f6f3]">
                    {fmt(p.suggestedPrice)}
                    <span className="text-xs font-normal text-gray-400">{UNIT_LABELS[p.unit]}</span>
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleToggleActive(p)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors"
                  title={p.isActive ? "Désactiver" : "Activer"}
                >
                  {p.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors"
                  title="Modifier"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-[#f8f6f3] mb-4">
              {editingProduct ? "Modifier le produit" : "Nouveau produit de référence"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  placeholder="Entrecôte de boeuf"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catégorie</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unité</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  >
                    <option value="KG">Au kilo</option>
                    <option value="PIECE">A la pièce</option>
                    <option value="BARQUETTE">Barquette</option>
                    <option value="TRANCHE">A la tranche</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prix suggéré (centimes)
                  </label>
                  <input
                    type="number"
                    value={form.suggestedPrice}
                    onChange={(e) => setForm({ ...form, suggestedPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                    placeholder="1990"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origine</label>
                  <select
                    value={form.origin}
                    onChange={(e) => setForm({ ...form, origin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  >
                    {ORIGINS.map((o) => (
                      <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags (séparés par virgule)
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  placeholder="Halal, Premium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Image URL (optionnel)
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  placeholder="/img/products/boeuf-1.jpg"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">Actif</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#f8f6f3]"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name || !form.categoryId}
                className="px-6 py-2 bg-[#DC2626] text-white rounded-xl text-sm font-bold hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
              >
                {editingProduct ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-[#f8f6f3] mb-4">
              Nouvelle catégorie globale
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  placeholder="Boeuf"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emoji</label>
                  <input
                    type="text"
                    value={catForm.emoji}
                    onChange={(e) => setCatForm({ ...catForm, emoji: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                    placeholder="🥩"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ordre</label>
                  <input
                    type="number"
                    value={catForm.order}
                    onChange={(e) => setCatForm({ ...catForm, order: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!catForm.name}
                className="px-6 py-2 bg-[#DC2626] text-white rounded-xl text-sm font-bold hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
