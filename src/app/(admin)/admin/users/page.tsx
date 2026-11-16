"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ChevronDown, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { refusalMessageOf } from "@/lib/api/client-refusal";

// ── Types ────────────────────────────────────────
type User = {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyName: string | null;
  siret: string | null;
  sector: string | null;
  proStatus: string | null;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
};

type RoleFilter = "all" | "CLIENT" | "CLIENT_PRO" | "CLIENT_PRO_PENDING" | "BOUCHER" | "ADMIN";
type SortBy = "date" | "orders" | "spent" | "name";

const ROLES: { value: string; label: string; clerkValue: string }[] = [
  { value: "CLIENT", label: "Client", clerkValue: "client" },
  { value: "CLIENT_PRO", label: "Client Pro", clerkValue: "client_pro" },
  { value: "CLIENT_PRO_PENDING", label: "Pro en attente", clerkValue: "client_pro_pending" },
  { value: "BOUCHER", label: "Boucher", clerkValue: "boucher" },
  { value: "ADMIN", label: "Admin", clerkValue: "admin" },
];

// ── Helpers ──────────────────────────────────────
function roleBadge(role: string) {
  const styles: Record<string, string> = {
    CLIENT: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    CLIENT_PRO: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    CLIENT_PRO_PENDING: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
    BOUCHER: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
    ADMIN: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  };
  const labels: Record<string, string> = {
    CLIENT: "Client",
    CLIENT_PRO: "Pro",
    CLIENT_PRO_PENDING: "Pro pending",
    BOUCHER: "Boucher",
    ADMIN: "Admin",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[role] || "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"}`}
    >
      {labels[role] || role}
    </span>
  );
}

function initials(first: string, last: string) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase();
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Colors for avatar based on initials
const AVATAR_COLORS = [
  "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
  "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Page Component ───────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");

  // Role change dialog
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [newRole, setNewRole] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || json);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, []);

  // ── Filter & sort ──────────────────────────────
  const filtered = useMemo(() => {
    let list = [...users];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.companyName && u.companyName.toLowerCase().includes(q))
      );
    }

    if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }

    switch (sortBy) {
      case "orders":
        list.sort((a, b) => b.orderCount - a.orderCount);
        break;
      case "spent":
        list.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case "name":
        list.sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );
        break;
      // date is default (already sorted desc from API)
    }

    return list;
  }, [users, search, roleFilter, sortBy]);

  // ── Role change ────────────────────────────────
  function openRoleDialog(user: User) {
    setRoleTarget(user);
    const current = ROLES.find((r) => r.value === user.role);
    setNewRole(current?.clerkValue || "client");
    setSaving(false);
  }

  async function handleRoleChange() {
    if (!roleTarget || !newRole) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${roleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(refusalMessageOf(err) ?? "Erreur");
        return;
      }
      setRoleTarget(null);
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  // ── Stats summary ──────────────────────────────
  const stats = useMemo(() => {
    const byRole: Record<string, number> = {};
    users.forEach((u) => {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
    });
    return byRole;
  }, [users]);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">Utilisateurs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {users.length} utilisateur{users.length > 1 ? "s" : ""} inscrits
        </p>
      </div>

      {/* Role summary pills */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() =>
              setRoleFilter((prev) => (prev === r.value ? "all" : (r.value as RoleFilter)))
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              roleFilter === r.value
                ? "border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626]"
                : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-white/10 dark:text-gray-400 dark:hover:border-white/15"
            }`}
          >
            {r.label}
            <span className="text-[10px] font-bold opacity-70">{stats[r.value] || 0}</span>
          </button>
        ))}
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
            placeholder="Rechercher par nom, email, entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-[#f8f6f3] dark:text-gray-400"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
          >
            <option value="date">Plus récent</option>
            <option value="orders">Plus de commandes</option>
            <option value="spent">Plus gros client</option>
            <option value="name">Alphabétique</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          />
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-12 text-center dark:border-white/10 dark:bg-[#141414]">
          <p className="text-gray-500 dark:text-gray-400">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-[#141414] md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <th className="px-5 py-3 font-medium">Utilisateur</th>
                    <th className="px-4 py-3 font-medium">Rôle</th>
                    <th className="px-4 py-3 font-medium">Entreprise</th>
                    <th className="px-4 py-3 text-right font-medium">Commandes</th>
                    <th className="px-4 py-3 text-right font-medium">Total dépensé</th>
                    <th className="px-4 py-3 font-medium">Inscrit le</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/10">
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(user.firstName + user.lastName)}`}
                          >
                            {initials(user.firstName, user.lastName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900 dark:text-[#f8f6f3]">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{roleBadge(user.role)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {user.companyName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {user.orderCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-[#f8f6f3]">
                        {fmt(user.totalSpent)} €
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {fmtDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openRoleDialog(user)}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15"
                          title="Changer le rôle"
                        >
                          <ShieldCheck size={13} />
                          Rôle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141414]"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor(user.firstName + user.lastName)}`}
                  >
                    {initials(user.firstName, user.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
                        {user.firstName} {user.lastName}
                      </p>
                      {roleBadge(user.role)}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                    {user.companyName && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {user.companyName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {user.orderCount}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Commandes</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {fmt(user.totalSpent)} €
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Dépensé</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {fmtDate(user.createdAt)}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Inscrit</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
                  <button
                    onClick={() => openRoleDialog(user)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                  >
                    <ShieldCheck size={13} />
                    Changer le rôle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Role Change Dialog ──────────────────── */}
      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Changer le rôle</DialogTitle>
            <DialogDescription>
              {roleTarget
                ? `${roleTarget.firstName} ${roleTarget.lastName} (${roleTarget.email})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Nouveau rôle
              </label>
              <div className="relative">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 pr-8 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-[#f8f6f3]"
                >
                  {ROLES.map((r) => (
                    <option key={r.clerkValue} value={r.clerkValue}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                />
              </div>
            </div>

            {newRole === "admin" && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                Attention : ce rôle donne un accès complet à l&apos;administration.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoleTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-[#f8f6f3]"
              >
                Annuler
              </button>
              <button
                onClick={handleRoleChange}
                disabled={saving}
                className="rounded-lg bg-[#DC2626] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Confirmer"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
