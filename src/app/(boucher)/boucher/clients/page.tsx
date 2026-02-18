"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bell,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ProRequest = {
  id: string;
  userId: string;
  companyName: string;
  siret: string;
  sector: string;
  phone: string | null;
  requestedAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  orderCount: number;
};

type ClientStat = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  proStatus: string | null; // APPROVED, PENDING, null
  companyName: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
};

type Tab = "demandes" | "clients";
type SortKey = "lastOrder" | "totalSpent" | "orderCount";
type FilterKey = "all" | "pro" | "particulier";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20ac";
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const months = Math.floor(diff / (30 * 24 * 60 * 60 * 1000));
  if (months < 1) return "< 1 mois";
  return `${months} mois`;
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function BoucherClientsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("demandes");
  const [proRequests, setProRequests] = useState<ProRequest[]>([]);
  const [clients, setClients] = useState<ClientStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("lastOrder");
  const [filterBy, setFilterBy] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [shopId, setShopId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Get boucher's shop first
      const shopRes = await fetch("/api/shops?owned=true");
      if (!shopRes.ok) throw new Error();
      const shopJson = await shopRes.json();
      const shop = shopJson.data?.[0];
      if (!shop) {
        setError("Aucune boucherie trouvée");
        setLoading(false);
        return;
      }
      setShopId(shop.id);

      // Fetch pro requests and clients in parallel
      const [proRes, clientsRes] = await Promise.all([
        fetch(`/api/shops/${shop.id}/pro-requests`),
        fetch("/api/boucher/clients"),
      ]);

      if (proRes.ok) {
        const proJson = await proRes.json();
        const all = proJson.data || [];
        setProRequests(all.filter((r: ProRequest & { status?: string }) => (r as any).status === "PENDING"));
      }

      if (clientsRes.ok) {
        const clientsJson = await clientsRes.json();
        setClients(clientsJson.data || []);
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

  // ── Validate/Reject pro ──
  async function handleProAction(proAccessId: string, action: "APPROVED" | "REJECTED") {
    if (!shopId) return;
    setActionLoading(proAccessId);
    try {
      const body: any = { status: action };
      if (action === "REJECTED" && rejectNotes[proAccessId]) {
        body.notes = rejectNotes[proAccessId];
      }
      const res = await fetch(`/api/shops/${shopId}/pro-requests/${proAccessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setProRequests((prev) => prev.filter((r) => r.id !== proAccessId));
        toast.success(action === "APPROVED" ? "Accès Pro validé" : "Demande refusée");
        setShowRejectForm(null);
        // Refresh clients
        const clientsRes = await fetch("/api/boucher/clients");
        if (clientsRes.ok) {
          const json = await clientsRes.json();
          setClients(json.data || []);
        }
      } else {
        toast.error("Erreur lors de l'action");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Sort + filter clients ──
  const filteredClients = clients
    .filter((c) => {
      if (filterBy === "pro") return c.proStatus === "APPROVED";
      if (filterBy === "particulier") return !c.proStatus || c.proStatus !== "APPROVED";
      return true;
    })
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "totalSpent") return b.totalSpent - a.totalSpent;
      if (sortBy === "orderCount") return b.orderCount - a.orderCount;
      if (!a.lastOrderDate) return 1;
      if (!b.lastOrderDate) return -1;
      return b.lastOrderDate.localeCompare(a.lastOrderDate);
    });

  const tabs = [
    { key: "demandes" as Tab, label: "Demandes Pro", count: proRequests.length, icon: Bell },
    { key: "clients" as Tab, label: "Mes clients", count: clients.length, icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white dark:bg-[#141414] rounded-xl p-1 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#DC2626] text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                      isActive ? "bg-white/20 text-white" : tab.key === "demandes" ? "bg-[#DC2626] text-white" : "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── DEMANDES PRO ── */}
        {activeTab === "demandes" && (
          <div className="space-y-3">
            {proRequests.length === 0 ? (
              <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
                <CardContent className="py-12 flex flex-col items-center gap-2">
                  <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">Aucune demande Pro en attente</p>
                </CardContent>
              </Card>
            ) : (
              proRequests.map((req) => (
                <Card key={req.id} className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
                  <div className="h-1 bg-amber-400" />
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {req.user.firstName} {req.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{req.user.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                        En attente
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="bg-gray-50 dark:bg-[#0a0a0a] rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{req.companyName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500 w-14 shrink-0">SIRET</span>
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{req.siret}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500 w-14 shrink-0">Secteur</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{req.sector}</span>
                      </div>
                      {req.phone && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 dark:text-gray-500 w-14 shrink-0">Tél</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{req.phone}</span>
                        </div>
                      )}
                      <div className="pt-1 border-t border-gray-200 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400">
                        {req.orderCount} commande{req.orderCount > 1 ? "s" : ""} passée{req.orderCount > 1 ? "s" : ""} · Client depuis {timeSince(req.requestedAt)}
                      </div>
                    </div>

                    {/* Reject notes form */}
                    {showRejectForm === req.id && (
                      <div>
                        <textarea
                          placeholder="Raison du refus (optionnel)..."
                          value={rejectNotes[req.id] || ""}
                          onChange={(e) => setRejectNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          className="w-full text-sm p-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white resize-none"
                          rows={2}
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1"
                        onClick={() => handleProAction(req.id, "APPROVED")}
                        disabled={actionLoading === req.id}
                      >
                        {actionLoading === req.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1"
                        onClick={() => {
                          if (showRejectForm === req.id) {
                            handleProAction(req.id, "REJECTED");
                          } else {
                            setShowRejectForm(req.id);
                          }
                        }}
                        disabled={actionLoading === req.id}
                      >
                        <XCircle size={14} />
                        {showRejectForm === req.id ? "Confirmer refus" : "Refuser"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── MES CLIENTS ── */}
        {activeTab === "clients" && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Rechercher un client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 border-gray-200 dark:border-white/10 dark:bg-[#141414] dark:text-white"
              />
            </div>

            {/* Filter + Sort controls */}
            <div className="flex items-center gap-3">
              {/* Filter */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {([
                  { key: "all", label: "Tous" },
                  { key: "pro", label: "Pro" },
                  { key: "particulier", label: "Particuliers" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setFilterBy(opt.key)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      filterBy === opt.key
                        ? "bg-[#DC2626] text-white"
                        : "bg-white dark:bg-[#141414] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />

              {/* Sort */}
              <div className="flex items-center gap-1 overflow-x-auto">
                <ArrowUpDown size={12} className="text-gray-400 shrink-0" />
                {([
                  { key: "lastOrder", label: "Récent" },
                  { key: "totalSpent", label: "Dépensé" },
                  { key: "orderCount", label: "Commandes" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${
                      sortBy === opt.key
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredClients.length === 0 ? (
              <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
                <CardContent className="py-12 flex flex-col items-center gap-2">
                  <Users className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">Aucun client trouvé</p>
                </CardContent>
              </Card>
            ) : (
              filteredClients.map((client) => (
                <Card key={client.userId} className="bg-white dark:bg-[#141414] border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {client.firstName} {client.lastName}
                          </p>
                          {client.proStatus === "APPROVED" ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shrink-0">PRO</span>
                          ) : client.proStatus === "PENDING" ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 shrink-0">EN ATTENTE</span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 shrink-0">Particulier</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{client.email}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatPrice(client.totalSpent)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {client.orderCount} cmd{client.orderCount > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    {client.lastOrderDate && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                        Dernière commande : {formatDate(client.lastOrderDate)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
