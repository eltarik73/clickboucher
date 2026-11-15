"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Pause, Play, Star, ChevronDown, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { refusalMessage } from "@/lib/api/client-refusal";

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
  status: string;
  rating: number;
  ratingCount: number;
  commissionPct: number;
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  productCount: number;
  orderCount: number;
  reviewCount: number;
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
  switch (shop.status) {
    case "PAUSED":
    case "AUTO_PAUSED":
      return (
        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-400">
          Pause
        </span>
      );
    case "BUSY":
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400">
          Occupé
        </span>
      );
    case "CLOSED":
    case "VACATION":
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400">
          Fermé
        </span>
      );
    case "OPEN":
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-400">
          Ouvert
        </span>
      );
  }
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pausing is the shop's own service switch, not the admin suspension (« Suspendre »). */
function pauseActionLabel(shop: Shop) {
  const isPaused = shop.status === "PAUSED" || shop.status === "AUTO_PAUSED";
  return isPaused ? "Reprendre" : "Mettre en pause";
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
      if (res.ok) {
        const json = await res.json();
        setShops(json.data || json);
      }
    } catch {
      /* ignore */
    }
  }

  async function loadBouchers() {
    try {
      const res = await fetch("/api/admin/shops", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setBouchers(json.data || json);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    Promise.all([loadShops(), loadBouchers()]).finally(() => setLoading(false));
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
      list = list.filter((s) => s.status === "OPEN" || s.status === "BUSY");
    if (statusFilter === "closed")
      list = list.filter((s) => s.status === "CLOSED" || s.status === "VACATION");
    if (statusFilter === "paused")
      list = list.filter((s) => s.status === "PAUSED" || s.status === "AUTO_PAUSED");

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
      const commissionPct = parseFloat(form.commissionPct) || 0;
      const payload: Record<string, unknown> = {
        name: form.name,
        address: form.address,
        city: form.city,
        phone: form.phone,
        description: form.description || undefined,
      };

      let res: Response;

      if (editShop) {
        // PATCH existing
        res = await fetch(`/api/shops/${editShop.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        // The commission has one writer, the audited admin route. This dialog edits the rate
        // only: whether commission is charged stays as it is.
        if (res.ok && commissionPct !== editShop.commissionPct) {
          res = await fetch(`/api/admin/shops/${editShop.id}/commission`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commissionPct }),
          });
        }
      } else {
        // POST new
        payload.slug = form.slug || slugify(form.name);
        payload.ownerId = form.ownerId;
        payload.commissionPct = commissionPct;
        res = await fetch("/api/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error(await refusalMessage(res));

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
    const isPaused = shop.status === "PAUSED" || shop.status === "AUTO_PAUSED";
    try {
      const res = await fetch(`/api/shops/${shop.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isPaused ? "OPEN" : "PAUSED" }),
      });
      if (!res.ok) {
        toast.error(await refusalMessage(res));
        return;
      }
      await loadShops();
    } catch {
      toast.error("Erreur réseau");
    }
  }

  // ── Delete ─────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shops/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert(await refusalMessage(res));
        return;
      }
      setDeleteTarget(null);
      await loadShops();
    } catch {
      alert("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DC2626] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">Boucheries</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {shops.length} boucherie{shops.length > 1 ? "s" : ""} sur la plateforme
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c]"
        >
          <Plus size={16} />
          Ajouter une boucherie
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher par nom, ville, propriétaire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-[#f8f6f3] dark:text-gray-400"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
            >
              <option value="all">Tous les statuts</option>
              <option value="open">Ouvert</option>
              <option value="closed">Fermé</option>
              <option value="paused">En pause</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
            >
              <option value="date">Plus récent</option>
              <option value="rating">Meilleure note</option>
              <option value="orders">Plus de commandes</option>
              <option value="name">Alphabétique</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-12 text-center dark:border-white/10 dark:bg-[#141414]">
          <p className="text-gray-500 dark:text-gray-400">Aucune boucherie trouvée.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-[#141414] md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <th className="px-5 py-3 font-medium">Boucherie</th>
                    <th className="px-4 py-3 font-medium">Ville</th>
                    <th className="px-4 py-3 font-medium">Propriétaire</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 text-right font-medium">Note</th>
                    <th className="px-4 py-3 text-right font-medium">Produits</th>
                    <th className="px-4 py-3 text-right font-medium">Commandes</th>
                    <th className="px-4 py-3 text-right font-medium">Com. %</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/10">
                  {filtered.map((shop) => (
                    <tr
                      key={shop.id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-900 dark:text-[#f8f6f3]">
                          {shop.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{shop.city}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {shop.ownerName}
                          </p>
                          {shop.ownerEmail && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {shop.ownerEmail}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{statusBadge(shop)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
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
                          <Link
                            href={`/admin/shops/${shop.id}`}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
                            title="Voir détail"
                          >
                            <Eye size={14} />
                          </Link>
                          <button
                            onClick={() => openEdit(shop)}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => togglePause(shop)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
                            title={pauseActionLabel(shop)}
                            aria-label={pauseActionLabel(shop)}
                          >
                            {shop.status === "PAUSED" || shop.status === "AUTO_PAUSED" ? (
                              <Play size={14} />
                            ) : (
                              <Pause size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(shop)}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-red-500/10"
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
          <div className="space-y-3 md:hidden">
            {filtered.map((shop) => (
              <div
                key={shop.id}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141414]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">{shop.name}</h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {shop.city} &middot; {shop.ownerName}
                    </p>
                  </div>
                  {statusBadge(shop)}
                </div>
                <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        <Star size={11} fill="currentColor" />
                        {shop.rating.toFixed(1)}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Note</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {shop.productCount}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Produits</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {shop.orderCount}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Commandes</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {shop.commissionPct}%
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Com.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
                  <button
                    onClick={() => openEdit(shop)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                  >
                    <Pencil size={12} /> Modifier
                  </button>
                  <button
                    onClick={() => togglePause(shop)}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                  >
                    {shop.status === "PAUSED" || shop.status === "AUTO_PAUSED" ? (
                      <>
                        <Play size={12} /> Reprendre
                      </>
                    ) : (
                      <>
                        <Pause size={12} /> Mettre en pause
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(shop)}
                    className="rounded-lg bg-gray-50 p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-red-500/10"
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
            <DialogTitle>{editShop ? "Modifier la boucherie" : "Nouvelle boucherie"}</DialogTitle>
            <DialogDescription>
              {editShop
                ? "Modifiez les informations de la boucherie."
                : "Remplissez les informations pour créer une nouvelle boucherie."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            {formError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
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
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                />
              </div>
              {!editShop && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Slug *
                  </label>
                  <input
                    required
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    pattern="[a-z0-9\-]+"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                  />
                </div>
              )}
              {editShop && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Commission %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.commissionPct}
                    onChange={(e) => setForm((f) => ({ ...f, commissionPct: e.target.value }))}
                    aria-describedby="edit-commission-hint"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                  />
                  <p
                    id="edit-commission-hint"
                    className="mt-1 text-xs text-gray-500 dark:text-gray-400"
                  >
                    Change le taux seulement : la commission s&apos;active ou se coupe depuis la
                    page Commission.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Adresse *
              </label>
              <input
                required
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Ville *
                </label>
                <input
                  required
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Téléphone *
                </label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+33 X XX XX XX XX"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Description
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
              />
            </div>

            {!editShop && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Propriétaire (Boucher) *
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={form.ownerId}
                      onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                    >
                      <option value="">Sélectionner...</option>
                      {bouchers.map((b) => (
                        <option key={b.clerkId} value={b.clerkId}>
                          {b.firstName} {b.lastName} ({b.email})
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
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
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-[#f8f6f3]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#DC2626] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : editShop ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la boucherie</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes les données (produits, catégories) seront
              supprimées.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5">
            <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
              Voulez-vous vraiment supprimer <strong>{deleteTarget?.name}</strong> ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-[#f8f6f3]"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
