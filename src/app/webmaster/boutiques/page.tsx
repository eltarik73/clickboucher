"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  Store,
  Search,
  Star,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import Image from "next/image";

// ── Types ──

type ShopAdmin = {
  id: string;
  name: string;
  slug: string;
  city: string;
  phone: string;
  imageUrl: string | null;
  status: string;
  visible: boolean;
  featured: boolean;
  rating: number;
  ratingCount: number;
  commissionPct: number;
  commissionEnabled: boolean;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  productCount: number;
  orderCount: number;
  reviewCount: number;
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: string | null;
    validatedAt: string | null;
  } | null;
};

// ── Helpers ──

import { SHOP_STATUS_COLORS as STATUS_COLORS, SUB_STATUS_COLORS, PLAN_COLORS } from "@/lib/design-tokens";

function ShopAvatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return (
    <div
      className="rounded-[14px] overflow-hidden bg-gray-100 dark:bg-white/10 grid place-items-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={name} width={size} height={size} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-500 dark:text-gray-400 font-bold" style={{ fontSize: size * 0.3 }}>
          {name?.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

// ── Component ──

export default function WebmasterBoutiquesPage() {
  const [shops, setShops] = useState<ShopAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "rating" | "orders">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/admin/shops")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setShops(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Client-side filtering and sorting
  const filtered = useMemo(() => {
    let result = [...shops];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          (s.ownerName && s.ownerName.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Subscription filter
    if (subFilter !== "all") {
      if (subFilter === "none") {
        result = result.filter((s) => !s.subscription);
      } else {
        result = result.filter((s) => s.subscription?.status === subFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "rating": cmp = a.rating - b.rating; break;
        case "orders": cmp = a.orderCount - b.orderCount; break;
        case "createdAt":
        default: cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [shops, search, statusFilter, subFilter, sortBy, sortDir]);

  async function toggleField(id: string, field: "featured" | "visible") {
    const shop = shops.find((s) => s.id === id);
    if (!shop) return;
    const newVal = !shop[field];

    setShops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: newVal } : s)));
    try {
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newVal }),
      });
      if (!res.ok) {
        setShops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: !newVal } : s)));
      }
    } catch {
      setShops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: !newVal } : s)));
    }
  }

  function toggleSort(key: typeof sortBy) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store size={20} /> Boutiques
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {shops.length} boucherie{shops.length > 1 ? "s" : ""} enregistree{shops.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, ville, proprietaire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300"
        >
          <option value="all">Tous statuts</option>
          <option value="OPEN">Ouverte</option>
          <option value="BUSY">Occupee</option>
          <option value="PAUSED">Pause</option>
          <option value="CLOSED">Fermee</option>
          <option value="VACATION">Vacances</option>
        </select>

        {/* Subscription filter */}
        <select
          value={subFilter}
          onChange={(e) => setSubFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300"
        >
          <option value="all">Tous abonnements</option>
          <option value="TRIAL">Essai</option>
          <option value="ACTIVE">Actif</option>
          <option value="SUSPENDED">Suspendu</option>
          <option value="CANCELLED">Annule</option>
          <option value="none">Sans abonnement</option>
        </select>

        {/* Sort */}
        <button
          onClick={() => toggleSort(sortBy === "createdAt" ? "name" : sortBy === "name" ? "rating" : sortBy === "rating" ? "orders" : "createdAt")}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <ArrowUpDown size={12} />
          {sortBy === "createdAt" ? "Date" : sortBy === "name" ? "Nom" : sortBy === "rating" ? "Note" : "Commandes"}
          {sortDir === "desc" ? " ↓" : " ↑"}
        </button>
      </div>

      {/* Results count */}
      {search || statusFilter !== "all" || subFilter !== "all" ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{filtered.length} resultat{filtered.length > 1 ? "s" : ""}</p>
      ) : null}

      {/* Shop cards */}
      <div className="space-y-2.5">
        {filtered.map((s, i) => (
          <div
            key={s.id}
            className={`bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4 animate-fade-up transition-all ${
              !s.visible ? "opacity-50" : ""
            }`}
            style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}
          >
            <div className="flex gap-3.5 items-start">
              <ShopAvatar src={s.imageUrl} name={s.name} size={48} />

              <div className="flex-1 min-w-0">
                {/* Row 1: Name + badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {s.name}
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${STATUS_COLORS[s.status] || "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"}`}>
                    {s.status}
                  </span>
                  {s.subscription && (
                    <>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${PLAN_COLORS[s.subscription.plan] || ""}`}>
                        {s.subscription.plan}
                      </span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${SUB_STATUS_COLORS[s.subscription.status] || ""}`}>
                        {s.subscription.status}
                      </span>
                    </>
                  )}
                  {s.featured && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      En avant
                    </span>
                  )}
                </div>

                {/* Row 2: Info */}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {s.city}
                  {s.rating > 0 ? ` · ${s.rating.toFixed(1)}★` : ""}
                  {` · ${s.productCount} prod. · ${s.orderCount} cmd.`}
                  {s.commissionEnabled ? ` · ${s.commissionPct}% com.` : ""}
                </p>

                {/* Row 3: Owner */}
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {s.ownerName}
                  {s.ownerEmail ? ` · ${s.ownerEmail}` : ""}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleField(s.id, "featured")}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all ${
                    s.featured
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                  title={s.featured ? "Retirer la mise en avant" : "Mettre en avant"}
                >
                  <Star size={14} fill={s.featured ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => toggleField(s.id, "visible")}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all ${
                    s.visible
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-500"
                  }`}
                  title={s.visible ? "Masquer" : "Rendre visible"}
                >
                  {s.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <Link
                  href={`/webmaster/boutiques/${s.id}`}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-all"
                  title="Voir le detail"
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-12">Aucune boucherie trouvee</p>
        )}
      </div>
    </div>
  );
}
