"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Loader2,
  Copy,
  Check,
  X,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Clock,
  Activity,
  AlertTriangle,
  Store,
  Eye,
  EyeOff,
} from "lucide-react";

/* ─── Types ─── */
interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  shop: { id: string; name: string } | null;
  createdBy: string;
  createdAt: string;
}

interface Stats {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  totalUsage: number;
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

function isExpired(expiresAt: string | null) {
  return expiresAt && new Date(expiresAt).getTime() < Date.now();
}

const SCOPE_LABELS: Record<string, string> = {
  "orders:read": "Commandes (lecture)",
  "orders:write": "Commandes (écriture)",
  "products:read": "Produits (lecture)",
  "products:write": "Produits (écriture)",
  "shops:read": "Boutiques (lecture)",
  "customers:read": "Clients (lecture)",
  "analytics:read": "Analytics (lecture)",
};

/* ================================================================== */
export default function WebmasterApiKeysPage() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState({
    name: "",
    scopes: [] as string[],
    rateLimit: 60,
    expiresInDays: 0,
    shopId: "",
  });
  const [creating, setCreating] = useState(false);

  // Newly created key (shown once)
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Actions
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Shops list for assignment
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webmaster/api-keys");
      const d = await res.json();
      if (d.success) {
        setKeys(d.data.keys);
        setStats(d.data.stats);
        setAvailableScopes(d.data.availableScopes);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/shops");
      const d = await res.json();
      if (d.success) {
        setShops(
          d.data.map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          }))
        );
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchShops();
  }, [fetchKeys, fetchShops]);

  /* ── Create key ── */
  const handleCreate = async () => {
    if (!newKey.name || newKey.scopes.length === 0) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        name: newKey.name,
        scopes: newKey.scopes,
        rateLimit: newKey.rateLimit,
      };
      if (newKey.expiresInDays > 0) body.expiresInDays = newKey.expiresInDays;
      if (newKey.shopId) body.shopId = newKey.shopId;

      const res = await fetch("/api/webmaster/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        setCreatedKey(d.data.key);
        setShowCreate(false);
        setNewKey({ name: "", scopes: [], rateLimit: 60, expiresInDays: 0, shopId: "" });
        fetchKeys();
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setCreating(false);
    }
  };

  /* ── Toggle active ── */
  const toggleActive = async (k: ApiKeyItem) => {
    setTogglingId(k.id);
    const prev = k.isActive;
    setKeys((ks) =>
      ks.map((key) => (key.id === k.id ? { ...key, isActive: !prev } : key))
    );
    try {
      const res = await fetch(`/api/webmaster/api-keys/${k.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !prev }),
      });
      if (!res.ok) {
        setKeys((ks) =>
          ks.map((key) => (key.id === k.id ? { ...key, isActive: prev } : key))
        );
      }
    } catch {
      setKeys((ks) =>
        ks.map((key) => (key.id === k.id ? { ...key, isActive: prev } : key))
      );
      toast.error("Erreur de connexion au serveur");
    } finally {
      setTogglingId(null);
    }
  };

  /* ── Delete key ── */
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/webmaster/api-keys/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys((ks) => ks.filter((k) => k.id !== id));
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  /* ── Copy key ── */
  const copyKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Toggle scope ── */
  const toggleScope = (scope: string) => {
    setNewKey((v) => ({
      ...v,
      scopes: v.scopes.includes(scope)
        ? v.scopes.filter((s) => s !== scope)
        : [...v.scopes, scope],
    }));
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Key size={20} /> Clés API
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Gérez les clés d&apos;accès pour les intégrations externes
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition"
        >
          <Plus size={14} /> Nouvelle clé
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* KPIs */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.totalKeys, icon: Key, bg: "bg-gray-50 dark:bg-white/[0.03]", color: "text-gray-600 dark:text-gray-400" },
            { label: "Actives", value: stats.activeKeys, icon: Shield, bg: "bg-emerald-50 dark:bg-emerald-500/10", color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Expirées", value: stats.expiredKeys, icon: Clock, bg: "bg-amber-50 dark:bg-amber-500/10", color: "text-amber-600 dark:text-amber-400" },
            { label: "Appels total", value: stats.totalUsage.toLocaleString("fr-FR"), icon: Activity, bg: "bg-blue-50 dark:bg-blue-500/10", color: "text-blue-600 dark:text-blue-400" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`${s.bg} rounded-2xl p-3.5 flex items-center gap-3`}>
                <Icon size={18} className={s.color} />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Newly created key banner */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {createdKey && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Check size={16} /> Clé API créée avec succès
            </h3>
            <button
              onClick={() => {
                setCreatedKey(null);
                setShowKey(false);
              }}
              className="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Copiez cette clé maintenant. Elle ne sera <strong>plus jamais affichée</strong>.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#141414] border border-emerald-200 dark:border-emerald-500/20 text-gray-900 dark:text-white font-mono select-all">
              {showKey ? createdKey : createdKey.slice(0, 12) + "•".repeat(36)}
            </code>
            <button
              onClick={() => setShowKey((v) => !v)}
              className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
              title={showKey ? "Masquer" : "Afficher"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              onClick={copyKey}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-xl font-medium transition ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Create form */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-red-200 dark:border-red-500/20 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus size={14} /> Nouvelle clé API
            </h2>
            <button
              onClick={() => setShowCreate(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
              Nom de la clé *
            </label>
            <input
              type="text"
              value={newKey.name}
              onChange={(e) => setNewKey((v) => ({ ...v, name: e.target.value }))}
              placeholder="Ex: Intégration caisse, App mobile..."
              className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
              Permissions (scopes) *
            </label>
            <div className="flex flex-wrap gap-2">
              {availableScopes.map((scope) => (
                <button
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    newKey.scopes.includes(scope)
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                >
                  {SCOPE_LABELS[scope] || scope}
                </button>
              ))}
            </div>
          </div>

          {/* Rate limit + expiry */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Rate limit (req/min)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={newKey.rateLimit}
                onChange={(e) =>
                  setNewKey((v) => ({ ...v, rateLimit: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Expiration (jours, 0 = jamais)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={newKey.expiresInDays}
                onChange={(e) =>
                  setNewKey((v) => ({ ...v, expiresInDays: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Boutique (optionnel)
              </label>
              <select
                value={newKey.shopId}
                onChange={(e) =>
                  setNewKey((v) => ({ ...v, shopId: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="">Plateforme (global)</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-1">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-start gap-2 flex-1 mr-3">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                La clé ne sera affichée qu&apos;une seule fois après création.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newKey.name || newKey.scopes.length === 0 || creating}
              className="flex items-center gap-1.5 px-5 py-2 text-sm rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition flex-shrink-0"
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Key size={14} />
              )}
              Générer
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Keys list */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-2">
          <Key size={16} className="text-gray-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex-1">
            Clés existantes
          </h2>
          <span className="text-xs text-gray-400">
            {keys.length} clé{keys.length > 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12">
            <Key size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400">Aucune clé API créée</p>
            <p className="text-xs text-gray-400 mt-1">
              Créez votre première clé pour les intégrations externes.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {keys.map((k) => {
              const expired = isExpired(k.expiresAt);
              const active = k.isActive && !expired;

              return (
                <div
                  key={k.id}
                  className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${
                    !active ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Key icon + info */}
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Key
                        size={18}
                        className={
                          active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-400"
                        }
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {k.name}
                        </span>
                        <code className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                          {k.keyPrefix}...
                        </code>
                        {/* Status badges */}
                        {expired ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                            Expirée
                          </span>
                        ) : k.isActive ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-gray-200 dark:bg-white/10 text-gray-500">
                            Désactivée
                          </span>
                        )}
                        {k.shop && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Store size={10} /> {k.shop.name}
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        <span>{(k.scopes as string[]).length} scope{(k.scopes as string[]).length > 1 ? "s" : ""}</span>
                        <span>{k.rateLimit} req/min</span>
                        <span>{k.usageCount.toLocaleString("fr-FR")} appels</span>
                        {k.lastUsedAt && (
                          <span>Utilisée {timeAgo(k.lastUsedAt)}</span>
                        )}
                        <span>Par {k.createdBy}</span>
                      </div>

                      {/* Scopes tags */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(k.scopes as string[]).map((scope) => (
                          <span
                            key={scope}
                            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => toggleActive(k)}
                        disabled={togglingId === k.id}
                        className={`p-2 rounded-lg transition ${
                          k.isActive
                            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                        }`}
                        title={k.isActive ? "Désactiver" : "Activer"}
                      >
                        {togglingId === k.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : k.isActive ? (
                          <ToggleRight size={20} />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                      </button>

                      {/* Delete */}
                      {confirmDeleteId === k.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(k.id)}
                            disabled={deletingId === k.id}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                          >
                            {deletingId === k.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Check size={11} />
                            )}
                            Supprimer
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(k.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expiry info */}
                  {k.expiresAt && (
                    <div className="mt-2 ml-13 text-xs text-gray-400">
                      <Clock size={11} className="inline mr-1" />
                      Expire le{" "}
                      {new Date(k.expiresAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {expired && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                          (expirée)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
