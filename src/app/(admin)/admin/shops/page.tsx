"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
  Star,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────
type Shop = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  description: string | null;
  imageUrl: string | null;
  isOpen: boolean;
  paused: boolean;
  busyMode: boolean;
  rating: number;
  ratingCount: number;
  commissionPct: number;
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  productCount: number;
  orderCount: number;
};

type Boucher = {
  clerkId: string;
  firstName: string;
  lastName: string;
  email: string;
};

type FormData = {
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  description: string;
  commissionPct: string;
  ownerId: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  slug: "",
  address: "",
  city: "Chambéry",
  phone: "",
  description: "",
  commissionPct: "0",
  ownerId: "",
};

type StatusFilter = "all" | "open" | "closed" | "paused";
type SortBy = "date" | "rating" | "orders" | "name";

// ── Helpers ──────────────────────────────────────
function statusBadge(shop: Shop) {
  if (shop.paused)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400">
        Pause
      </span>
    );
  if (shop.busyMode)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400">
        Occupé
      </span>
    );
  if (!shop.isOpen)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
        Fermé
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
      Ouvert
    </span>
  );
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Page Component ───────────────────────────────
export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [bouchers, setBouchers] = useState<Boucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load data ──────────────────────────────────
  async function loadShops() {
    try {
      const res = await fetch("/api/admin/shops");
      if (res.ok) setShops(await res.json());
    } catch {
      /* ignore */
    }
  }

  async function loadBouchers() {
    try {
      const res = await fetch("/api/admin/shops", { method: "POST" });
      if (res.ok) setBouchers(await res.json());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    Promise.all([loadShops(), loadBouchers()]).finally(() =>
      setLoading(false)
    );
  }, []);

  // ── Filter & sort ──────────────────────────────
  const filtered = useMemo(() => {
    let list = [...shops];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.ownerName.toLowerCase().includes(q)
      );
    }

    if (statusFilter === "open")
      list = list.filter((s) => s.isOpen && !s.paused);
    if (statusFilter === "closed") list = list.filter((s) => !s.isOpen);
    if (statusFilter === "paused") list = list.filter((s) => s.paused);

    if (sortBy === "rating") list.sort((a, b) => b.rating - a.rating);
    if (sortBy === "orders") list.sort((a, b) => b.orderCount - a.orderCount);
    if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [shops, search, statusFilter, sortBy]);

  // ── Open create dialog ─────────────────────────
  function openCreate() {
    setEditShop(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  // ── Open edit dialog ───────────────────────────
  function openEdit(shop: Shop) {
    setEditShop(shop);
    setForm({
      name: shop.name,
      slug: shop.slug,
      address: shop.address,
      city: shop.city,
      phone: shop.phone,
      description: shop.description || "",
      commissionPct: shop.commissionPct.toString(),
      ownerId: shop.ownerId,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  // ── Submit create/edit ─────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        address: form.address,
        city: form.city,
        phone: form.phone,
        description: form.description || undefined,
        commissionPct: parseFloat(form.commissionPct) || 0,
      };

      let res: Response;

      if (editShop) {
        // PATCH existing
        res = await fetch(`/api/shops/${editShop.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // POST new
        payload.slug = form.slug || slugify(form.name);
        payload.ownerId = form.ownerId;
        res = await fetch("/api/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || err?.message || "Erreur serveur");
      }

      setDialogOpen(false);
      await loadShops();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle pause ───────────────────────────────
  async function togglePause(shop: Shop) {
    await fetch(`/api/shops/${shop.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !shop.paused }),
    });
    await loadShops();
  }

  // ── Delete ─────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/shops/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await loadShops();
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            Boucheries
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {shops.length} boucherie{shops.length > 1 ? "s" : ""} sur la
            plateforme
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] transition-colors shrink-0"
        >
          <Plus size={16} />
          Ajouter une boucherie
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher par nom, ville, propriétaire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#2a2520] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/30 text-gray-900 dark:text-[#f8f6f3] placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
              className="appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-[#2a2520] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[#DC2626]/30"
            >
              <option value="all">Tous les statuts</option>
              <option value="open">Ouvert</option>
              <option value="closed">Fermé</option>
              <option value="paused">En pause</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-[#2a2520] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[#DC2626]/30"
            >
              <option value="date">Plus récent</option>
              <option value="rating">Meilleure note</option>
              <option value="orders">Plus de commandes</option>
              <option value="name">Alphabétique</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] p-12 text-center">
          <p className="text-gray-400 dark:text-gray-500">
            Aucune boucherie trouv\u00e9e.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-[#3a3530]">
                    <th className="px-5 py-3 font-medium">Boucherie</th>
                    <th className="px-4 py-3 font-medium">Ville</th>
                    <th className="px-4 py-3 font-medium">Propri\u00e9taire</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium text-right">Note</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Produits
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Commandes
                    </th>
                    <th className="px-4 py-3 font-medium text-right">Com. %</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#3a3530]">
                  {filtered.map((shop) => (
                    <tr
                      key={shop.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-[#3a3530]/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-900 dark:text-[#f8f6f3]">
                          {shop.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {shop.city}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-gray-700 dark:text-gray-300 text-xs font-medium">
                            {shop.ownerName}
                          </p>
                          {shop.ownerEmail && (
                            <p className="text-gray-400 dark:text-gray-500 text-[11px]">
                              {shop.ownerEmail}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{statusBadge(shop)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                          <Star size={12} fill="currentColor" />
                          {shop.rating.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {shop.productCount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {shop.orderCount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {shop.commissionPct}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(shop)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3530] text-gray-500 dark:text-gray-400 transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => togglePause(shop)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3530] text-gray-500 dark:text-gray-400 transition-colors"
                            title={shop.paused ? "Reprendre" : "Suspendre"}
                          >
                            {shop.paused ? (
                              <Play size={14} />
                            ) : (
                              <Pause size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(shop)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((shop) => (
              <div
                key={shop.id}
                className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {shop.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {shop.city} &middot; {shop.ownerName}
                    </p>
                  </div>
                  {statusBadge(shop)}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        <Star size={11} fill="currentColor" />
                        {shop.rating.toFixed(1)}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400">Note</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {shop.productCount}
                    </p>
                    <p className="text-[10px] text-gray-400">Produits</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {shop.orderCount}
                    </p>
                    <p className="text-[10px] text-gray-400">Commandes</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {shop.commissionPct}%
                    </p>
                    <p className="text-[10px] text-gray-400">Com.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-[#3a3530]">
                  <button
                    onClick={() => openEdit(shop)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#3a3530] rounded-lg hover:bg-gray-100 dark:hover:bg-[#4a4540] transition-colors"
                  >
                    <Pencil size={12} /> Modifier
                  </button>
                  <button
                    onClick={() => togglePause(shop)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#3a3530] rounded-lg hover:bg-gray-100 dark:hover:bg-[#4a4540] transition-colors"
                  >
                    {shop.paused ? (
                      <>
                        <Play size={12} /> Reprendre
                      </>
                    ) : (
                      <>
                        <Pause size={12} /> Suspendre
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(shop)}
                    className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-[#3a3530] rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Create / Edit Dialog ────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editShop ? "Modifier la boucherie" : "Nouvelle boucherie"}
            </DialogTitle>
            <DialogDescription>
              {editShop
                ? "Modifiez les informations de la boucherie."
                : "Remplissez les informations pour cr\u00e9er une nouvelle boucherie."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nom *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      ...(!editShop ? { slug: slugify(name) } : {}),
                    }));
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                />
              </div>
              {!editShop && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Slug *
                  </label>
                  <input
                    required
                    value={form.slug}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slug: e.target.value }))
                    }
                    pattern="[a-z0-9\-]+"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30 font-mono"
                  />
                </div>
              )}
              {editShop && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Commission %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.commissionPct}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, commissionPct: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Adresse *
              </label>
              <input
                required
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Ville *
                </label>
                <input
                  required
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  T\u00e9l\u00e9phone *
                </label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+33 X XX XX XX XX"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30 resize-none"
              />
            </div>

            {!editShop && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Propri\u00e9taire (Boucher) *
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={form.ownerId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ownerId: e.target.value }))
                      }
                      className="w-full appearance-none px-3 pr-8 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                    >
                      <option value="">S\u00e9lectionner...</option>
                      {bouchers.map((b) => (
                        <option key={b.clerkId} value={b.clerkId}>
                          {b.firstName} {b.lastName} ({b.email})
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Commission %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.commissionPct}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        commissionPct: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1814] border border-gray-200 dark:border-[#3a3530] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#f8f6f3] transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
              >
                {saving
                  ? "Enregistrement..."
                  : editShop
                    ? "Enregistrer"
                    : "Cr\u00e9er"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la boucherie</DialogTitle>
            <DialogDescription>
              Cette action est irr\u00e9versible. Toutes les donn\u00e9es
              (produits, cat\u00e9gories) seront supprim\u00e9es.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Voulez-vous vraiment supprimer{" "}
              <strong>{deleteTarget?.name}</strong> ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#f8f6f3] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
