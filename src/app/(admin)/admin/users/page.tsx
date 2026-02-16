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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[role] || "bg-gray-100 text-gray-600"}`}
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
      if (res.ok) setUsers(await res.json());
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
        alert(err?.error || "Erreur");
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
        <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
          Utilisateurs
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {users.length} utilisateur{users.length > 1 ? "s" : ""} inscrits
        </p>
      </div>

      {/* Role summary pills */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() =>
              setRoleFilter((prev) =>
                prev === r.value ? "all" : (r.value as RoleFilter)
              )
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              roleFilter === r.value
                ? "border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626]"
                : "border-gray-200 dark:border-[white/10] text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-[white/15]"
            }`}
          >
            {r.label}
            <span className="text-[10px] font-bold opacity-70">
              {stats[r.value] || 0}
            </span>
          </button>
        ))}
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
            placeholder="Rechercher par nom, email, entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[white/10] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/30 text-gray-900 dark:text-[#f8f6f3] placeholder:text-gray-400"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[white/10] rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[#DC2626]/30"
          >
            <option value="date">Plus r\u00e9cent</option>
            <option value="orders">Plus de commandes</option>
            <option value="spent">Plus gros client</option>
            <option value="name">Alphab\u00e9tique</option>
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-[white/10] p-12 text-center">
          <p className="text-gray-400 dark:text-gray-500">
            Aucun utilisateur trouv\u00e9.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-[white/10] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-[white/10]">
                    <th className="px-5 py-3 font-medium">Utilisateur</th>
                    <th className="px-4 py-3 font-medium">R\u00f4le</th>
                    <th className="px-4 py-3 font-medium">Entreprise</th>
                    <th className="px-4 py-3 font-medium text-right">Commandes</th>
                    <th className="px-4 py-3 font-medium text-right">Total d\u00e9pens\u00e9</th>
                    <th className="px-4 py-3 font-medium">Inscrit le</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[white/10]">
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-[white/10]/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(user.firstName + user.lastName)}`}
                          >
                            {initials(user.firstName, user.lastName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-[#f8f6f3] truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{roleBadge(user.role)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {user.companyName || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {user.orderCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-[#f8f6f3]">
                        {fmt(user.totalSpent)} \u20ac
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {fmtDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openRoleDialog(user)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[white/10] rounded-lg hover:bg-gray-100 dark:hover:bg-[white/15] transition-colors"
                          title="Changer le r\u00f4le"
                        >
                          <ShieldCheck size={13} />
                          R\u00f4le
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-[white/10] shadow-sm p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(user.firstName + user.lastName)}`}
                  >
                    {initials(user.firstName, user.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
                        {user.firstName} {user.lastName}
                      </p>
                      {roleBadge(user.role)}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {user.email}
                    </p>
                    {user.companyName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {user.companyName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {user.orderCount}
                    </p>
                    <p className="text-[10px] text-gray-400">Commandes</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {fmt(user.totalSpent)} \u20ac
                    </p>
                    <p className="text-[10px] text-gray-400">D\u00e9pens\u00e9</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                      {fmtDate(user.createdAt)}
                    </p>
                    <p className="text-[10px] text-gray-400">Inscrit</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-[white/10]">
                  <button
                    onClick={() => openRoleDialog(user)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[white/10] rounded-lg hover:bg-gray-100 dark:hover:bg-[white/15] transition-colors"
                  >
                    <ShieldCheck size={13} />
                    Changer le r\u00f4le
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Role Change Dialog ──────────────────── */}
      <Dialog
        open={!!roleTarget}
        onOpenChange={(o) => !o && setRoleTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Changer le r\u00f4le</DialogTitle>
            <DialogDescription>
              {roleTarget
                ? `${roleTarget.firstName} ${roleTarget.lastName} (${roleTarget.email})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Nouveau r\u00f4le
              </label>
              <div className="relative">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full appearance-none px-3 pr-8 py-2.5 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[white/10] rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                >
                  {ROLES.map((r) => (
                    <option key={r.clerkValue} value={r.clerkValue}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>

            {newRole === "admin" && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400">
                Attention : ce r\u00f4le donne un acc\u00e8s complet \u00e0 l&apos;administration.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoleTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#f8f6f3] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRoleChange}
                disabled={saving}
                className="px-5 py-2 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
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
