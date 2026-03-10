"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Users,
  Shield,
  Plus,
  Loader2,
  Mail,
  Phone,
  Clock,
  Activity,
  UserMinus,
  AlertTriangle,
  Check,
  X,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ─── Types ─── */
interface StaffMember {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  auditCount: number;
  lastActivity: { action: string; createdAt: string } | null;
}

interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string | null;
  targetId: string | null;
  createdAt: string;
}

/* ─── Helpers ─── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    "shop.validate": "Validation boutique",
    "shop.suspend": "Suspension boutique",
    "shop.unsuspend": "Réactivation boutique",
    "shop.toggle_featured": "Mise en avant",
    "shop.toggle_visible": "Visibilité",
    "review.delete": "Suppression avis",
    "config.update": "Modif. config",
    "flag.update": "Modif. feature flag",
    "staff.promote": "Promotion admin",
    "staff.revoke": "Révocation admin",
    "commission.global_update": "Commission globale",
  };
  return map[action] || action;
}

/* ================================================================== */
export default function WebmasterStaffPage() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([]);

  // Promote form
  const [showPromote, setShowPromote] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState("");
  const [promoteSuccess, setPromoteSuccess] = useState("");

  // Revoke
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  // Activity log
  const [showActivity, setShowActivity] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webmaster/staff");
      const d = await res.json();
      if (d.success) {
        setStaff(d.data.staff);
        setTotalAdmins(d.data.totalAdmins);
        setRecentAudit(d.data.recentAudit);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  /* ── Promote ── */
  const handlePromote = async () => {
    if (!promoteEmail.trim()) return;
    setPromoting(true);
    setPromoteError("");
    setPromoteSuccess("");
    try {
      const res = await fetch("/api/webmaster/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: promoteEmail.trim() }),
      });
      const d = await res.json();
      if (d.success) {
        setPromoteSuccess(
          `${d.data.user.firstName} ${d.data.user.lastName} promu(e) administrateur`
        );
        setPromoteEmail("");
        setTimeout(() => {
          setPromoteSuccess("");
          setShowPromote(false);
        }, 2000);
        fetchStaff();
      } else {
        setPromoteError(d.error?.message || "Erreur");
      }
    } catch {
      setPromoteError("Erreur réseau");
    } finally {
      setPromoting(false);
    }
  };

  /* ── Revoke ── */
  const handleRevoke = async (userId: string) => {
    setRevoking(userId);
    try {
      const res = await fetch(`/api/webmaster/staff/${userId}`, {
        method: "PATCH",
      });
      const d = await res.json();
      if (d.success) {
        setStaff((s) => s.filter((m) => m.id !== userId));
        setTotalAdmins((c) => c - 1);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setRevoking(null);
      setConfirmRevoke(null);
    }
  };

  // Client-side search
  const filtered = search
    ? staff.filter(
        (m) =>
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
    : staff;

  // Active recently (last 7 days)
  const activeRecently = staff.filter(
    (m) =>
      m.lastActivity &&
      Date.now() - new Date(m.lastActivity.createdAt).getTime() < 7 * 86_400_000
  ).length;

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={20} /> Équipe
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Gestion des administrateurs de la plateforme
          </p>
        </div>
        <button
          onClick={() => setShowPromote(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* KPIs */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <Shield size={16} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{totalAdmins}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Admin{totalAdmins > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <Activity size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{activeRecently}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Actifs (7j)</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <Clock size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{recentAudit.length}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Actions récentes</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Promote form */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showPromote && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-red-200 dark:border-red-500/20 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus size={14} /> Promouvoir un utilisateur
            </h2>
            <button
              onClick={() => {
                setShowPromote(false);
                setPromoteError("");
                setPromoteSuccess("");
              }}
              className="p-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Entrez l&apos;email d&apos;un utilisateur existant pour lui donner les droits administrateur.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Email de l&apos;utilisateur
              </label>
              <input
                type="email"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePromote()}
                placeholder="email@exemple.com"
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            <button
              onClick={handlePromote}
              disabled={!promoteEmail.trim() || promoting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              {promoting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Shield size={14} />
              )}
              Promouvoir
            </button>
          </div>

          {promoteError && (
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{promoteError}</p>
            </div>
          )}
          {promoteSuccess && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center gap-2">
              <Check size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">{promoteSuccess}</p>
            </div>
          )}

          <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Un administrateur a <strong>accès complet</strong> au backoffice webmaster : boutiques, commandes, clients, configuration, etc.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Staff list */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-3">
          <Shield size={16} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex-1">
            Administrateurs
          </h2>
          {staff.length > 3 && (
            <div className="relative max-w-[200px]">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search ? "Aucun résultat" : "Aucun administrateur"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {m.firstName[0]}
                  {m.lastName[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {m.firstName} {m.lastName}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 flex-shrink-0">
                      ADMIN
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1 truncate">
                      <Mail size={11} /> {m.email}
                    </span>
                    {m.phone && (
                      <span className="flex items-center gap-1 hidden md:flex">
                        <Phone size={11} /> {m.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Activity stats */}
                <div className="hidden md:flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {m.auditCount} action{m.auditCount > 1 ? "s" : ""}
                  </span>
                  {m.lastActivity ? (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      Dernière : {timeAgo(m.lastActivity.createdAt)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300 dark:text-gray-600">
                      Jamais actif
                    </span>
                  )}
                </div>

                {/* Revoke */}
                {confirmRevoke === m.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleRevoke(m.id)}
                      disabled={revoking === m.id}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                    >
                      {revoking === m.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Check size={11} />
                      )}
                      Confirmer
                    </button>
                    <button
                      onClick={() => setConfirmRevoke(null)}
                      className="p-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRevoke(m.id)}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition flex-shrink-0"
                    title="Révoquer l'accès admin"
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Join date */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 dark:border-white/[0.03] text-[10px] text-gray-500 dark:text-gray-400">
            Premier admin ajouté le{" "}
            {new Date(
              staff.reduce(
                (min, m) => (m.createdAt < min ? m.createdAt : min),
                staff[0]?.createdAt || ""
              )
            ).toLocaleDateString("fr-FR")}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Recent activity log */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {recentAudit.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
          <button
            onClick={() => setShowActivity((v) => !v)}
            className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
          >
            <Activity size={16} className="text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-bold text-gray-900 dark:text-white flex-1">
              Activité récente
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
              {recentAudit.length} action{recentAudit.length > 1 ? "s" : ""}
            </span>
            {showActivity ? (
              <ChevronUp size={16} className="text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
            )}
          </button>

          {showActivity && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {recentAudit.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {a.actorName}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 mx-1">—</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {actionLabel(a.action)}
                      </span>
                      {a.target && (
                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                          ({a.target}
                          {a.targetId ? ` #${a.targetId.slice(0, 8)}` : ""})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
