"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
  ArrowUpDown,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ProRequest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  siret: string | null;
  sector: string | null;
  createdAt: string;
};

type ClientStat = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isPro: boolean;
  orderCount: number;
  totalSpent: number;
  lastOrder: string | null;
};

type Tab = "demandes" | "clients";
type SortKey = "lastOrder" | "totalSpent" | "orderCount";

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
  const [sortBy, setSortBy] = useState<SortKey>("lastOrder");

  const fetchData = useCallback(async () => {
    try {
      const [proRes, ordersRes] = await Promise.all([
        fetch("/api/users/pro-requests"),
        fetch("/api/orders"),
      ]);

      if (proRes.ok) {
        const proJson = await proRes.json();
        setProRequests(proJson.data || []);
      }

      if (ordersRes.ok) {
        const ordersJson = await ordersRes.json();
        const orders = ordersJson.data || [];

        // Aggregate client stats from orders
        const statsMap = new Map<string, ClientStat>();

        for (const order of orders) {
          const user = order.user;
          if (!user) continue;

          const key = user.id || user.clerkId;
          const existing = statsMap.get(key);

          if (existing) {
            existing.orderCount += 1;
            existing.totalSpent += order.totalCents;
            if (!existing.lastOrder || order.createdAt > existing.lastOrder) {
              existing.lastOrder = order.createdAt;
            }
          } else {
            statsMap.set(key, {
              userId: key,
              firstName: user.firstName || "",
              lastName: user.lastName || "",
              email: user.email || "",
              isPro: order.isPro || false,
              orderCount: 1,
              totalSpent: order.totalCents,
              lastOrder: order.createdAt,
            });
          }
        }

        setClients(Array.from(statsMap.values()));
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

  // ── Validate pro ──
  async function handleValidate(userId: string, action: "approve" | "reject") {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/users/${userId}/validate-pro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setProRequests((prev) => prev.filter((r) => r.id !== userId));
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  // ── Sort clients ──
  const sortedClients = [...clients].sort((a, b) => {
    if (sortBy === "totalSpent") return b.totalSpent - a.totalSpent;
    if (sortBy === "orderCount") return b.orderCount - a.orderCount;
    // lastOrder
    if (!a.lastOrder) return 1;
    if (!b.lastOrder) return -1;
    return b.lastOrder.localeCompare(a.lastOrder);
  });

  const tabs = [
    { key: "demandes" as Tab, label: "Demandes Pro", count: proRequests.length, icon: Bell },
    { key: "clients" as Tab, label: "Mes clients", count: clients.length, icon: Users },
  ];

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
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#8b2500] text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                      isActive ? "bg-white/20 text-white" : "bg-[#8b2500] text-white"
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
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="py-12 flex flex-col items-center gap-2">
                  <Bell className="w-10 h-10 text-gray-300" />
                  <p className="text-sm text-gray-400">Aucune demande Pro en attente</p>
                </CardContent>
              </Card>
            ) : (
              proRequests.map((req) => (
                <Card key={req.id} className="bg-white border-0 shadow-sm overflow-hidden">
                  <div className="h-1 bg-amber-400" />
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {req.firstName} {req.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{req.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">
                        En attente
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {req.companyName && (
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-700">{req.companyName}</span>
                        </div>
                      )}
                      {req.siret && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12 shrink-0">SIRET</span>
                          <span className="text-sm font-mono text-gray-700">{req.siret}</span>
                        </div>
                      )}
                      {req.sector && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12 shrink-0">Secteur</span>
                          <span className="text-sm text-gray-700">{req.sector}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-12 shrink-0">Date</span>
                        <span className="text-sm text-gray-700">{formatDate(req.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1"
                        onClick={() => handleValidate(req.id, "approve")}
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
                        onClick={() => handleValidate(req.id, "reject")}
                        disabled={actionLoading === req.id}
                      >
                        <XCircle size={14} /> Refuser
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
            {/* Sort controls */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
              {([
                { key: "lastOrder", label: "Dernier achat" },
                { key: "totalSpent", label: "Total depense" },
                { key: "orderCount", label: "Nb commandes" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    sortBy === opt.key
                      ? "bg-[#8b2500] text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {sortedClients.length === 0 ? (
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="py-12 flex flex-col items-center gap-2">
                  <Users className="w-10 h-10 text-gray-300" />
                  <p className="text-sm text-gray-400">Aucun client pour le moment</p>
                </CardContent>
              </Card>
            ) : (
              sortedClients.map((client) => (
                <Card key={client.userId} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {client.firstName} {client.lastName}
                          </p>
                          {client.isPro && (
                            <Badge variant="pro" className="text-[10px] shrink-0">PRO</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{client.email}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-bold text-gray-900">
                          {formatPrice(client.totalSpent)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {client.orderCount} cmd{client.orderCount > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    {client.lastOrder && (
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Derniere commande : {formatDate(client.lastOrder)}
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
