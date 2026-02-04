"use client";

import React, { useState } from "react";
import { Users, Briefcase, User, Star, ShoppingBag, CreditCard, ChevronRight, Search, Check, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TogglePill } from "@/components/ui/toggle-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice } from "@/lib/utils";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "CLIENT" | "PRO";
  companyName?: string;
  proStatus?: "PENDING" | "APPROVED" | "REJECTED";
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string;
  creditLimit?: number;
  creditBalance?: number;
  creditDueDays?: number;
}

const MOCK_CLIENTS: Client[] = [
  { id: "c1", firstName: "Marie", lastName: "Dupont", phone: "+33612345678", role: "CLIENT", orderCount: 12, totalSpent: 34500, lastOrderDate: new Date(Date.now() - 2 * 86400_000).toISOString() },
  { id: "c2", firstName: "Pierre", lastName: "Martin", phone: "+33623456789", role: "CLIENT", orderCount: 5, totalSpent: 15200, lastOrderDate: new Date(Date.now() - 86400_000).toISOString() },
  { id: "c3", firstName: "Sophie", lastName: "Moreau", phone: "+33634567890", role: "CLIENT", orderCount: 8, totalSpent: 22800, lastOrderDate: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { id: "c4", firstName: "Bob", lastName: "Burger", phone: "+33698765432", role: "PRO", companyName: "Bob's Burgers SARL", proStatus: "APPROVED", orderCount: 34, totalSpent: 245000, lastOrderDate: new Date(Date.now() - 86400_000).toISOString(), creditLimit: 500000, creditBalance: 178500, creditDueDays: 30 },
  { id: "c5", firstName: "Alain", lastName: "Ducasse", phone: "+33645678901", role: "PRO", companyName: "Le Chalet Savoyard", proStatus: "APPROVED", orderCount: 18, totalSpent: 156000, lastOrderDate: new Date(Date.now() - 5 * 86400_000).toISOString(), creditLimit: 300000, creditBalance: 82000, creditDueDays: 15 },
  { id: "c6", firstName: "Nadia", lastName: "Traiteur", phone: "+33667890123", role: "PRO", companyName: "Traiteur Alpin", proStatus: "APPROVED", orderCount: 7, totalSpent: 45600, lastOrderDate: new Date(Date.now() - 7 * 86400_000).toISOString(), creditLimit: 200000, creditBalance: 45600, creditDueDays: 30 },
  { id: "c7", firstName: "Éric", lastName: "Cantine", phone: "+33678901234", role: "PRO", companyName: "Cantine Scolaire", proStatus: "PENDING", orderCount: 0, totalSpent: 0, lastOrderDate: "" },
  { id: "c8", firstName: "Laura", lastName: "Pizzeria", phone: "+33689012345", role: "PRO", companyName: "Pizza Bella", proStatus: "REJECTED", orderCount: 0, totalSpent: 0, lastOrderDate: "" },
];

type Filter = "all" | "particuliers" | "pro";

export default function BoucherClientsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = MOCK_CLIENTS.filter((c) => {
    if (filter === "particuliers") return c.role === "CLIENT";
    if (filter === "pro") return c.role === "PRO";
    return true;
  }).filter((c) =>
    search === "" ||
    `${c.firstName} ${c.lastName} ${c.companyName || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const proCount = MOCK_CLIENTS.filter((c) => c.role === "PRO").length;
  const pendingProCount = MOCK_CLIENTS.filter((c) => c.proStatus === "PENDING").length;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Stats */}
      <div className="flex gap-2">
        <div className="flex-1 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-center">
          <p className="text-2xl font-display font-bold text-blue-700">{MOCK_CLIENTS.length}</p>
          <p className="text-xs text-blue-600">Total clients</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-primary/5 border border-primary/20 text-center">
          <p className="text-2xl font-display font-bold text-primary">{proCount}</p>
          <p className="text-xs text-primary">Comptes PRO</p>
        </div>
        {pendingProCount > 0 && (
          <div className="flex-1 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 text-center">
            <p className="text-2xl font-display font-bold text-orange-700">{pendingProCount}</p>
            <p className="text-xs text-orange-600">En attente</p>
          </div>
        )}
      </div>

      {/* Search + Filter */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      <div className="flex gap-2">
        <TogglePill active={filter === "all"} onClick={() => setFilter("all")} label="Tous" />
        <TogglePill active={filter === "particuliers"} onClick={() => setFilter("particuliers")} label="Particuliers" />
        <TogglePill active={filter === "pro"} onClick={() => setFilter("pro")} label="Professionnels" />
      </div>

      {/* Client List */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={28} strokeWidth={1.5} />} title="Aucun client" description="Les clients apparaîtront ici après leur première commande." />
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <div key={client.id} className="premium-card p-3">
              <button className="w-full text-left" onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${client.role === "PRO" ? "bg-primary/10" : "bg-muted"}`}>
                    {client.role === "PRO" ? <Briefcase size={18} className="text-primary" /> : <User size={18} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{client.firstName} {client.lastName}</span>
                      {client.role === "PRO" && <Badge variant="default" className="text-[10px] h-4">PRO</Badge>}
                      {client.proStatus === "PENDING" && <Badge variant="warning" className="text-[10px]">En attente</Badge>}
                      {client.proStatus === "REJECTED" && <Badge variant="destructive" className="text-[10px]">Refusé</Badge>}
                    </div>
                    {client.companyName && <p className="text-xs text-muted-foreground">{client.companyName}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-sm">{formatPrice(client.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground">{client.orderCount} cmd</p>
                  </div>
                </div>
              </button>

              {/* Expanded Detail */}
              {expandedId === client.id && (
                <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Téléphone</span>
                    <a href={`tel:${client.phone}`} className="text-primary font-medium">{client.phone}</a>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Commandes</span>
                    <span>{client.orderCount}</span>
                  </div>
                  {client.lastOrderDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dernière commande</span>
                      <span>{new Date(client.lastOrderDate).toLocaleDateString("fr-FR")}</span>
                    </div>
                  )}

                  {/* PRO Credit */}
                  {client.role === "PRO" && client.proStatus === "APPROVED" && client.creditLimit && (
                    <div className="p-3 rounded-xl bg-primary/5 space-y-2 mt-2">
                      <h4 className="font-semibold text-xs text-primary flex items-center gap-1">
                        <CreditCard size={12} />
                        Compte PRO
                      </h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Plafond</span>
                        <span className="font-bold">{formatPrice(client.creditLimit)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Solde en cours</span>
                        <span className="font-bold">{formatPrice(client.creditBalance!)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Délai paiement</span>
                        <span>{client.creditDueDays}j</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, (client.creditBalance! / client.creditLimit) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round((client.creditBalance! / client.creditLimit) * 100)}% du plafond utilisé
                      </p>
                    </div>
                  )}

                  {/* PRO Pending Actions */}
                  {client.proStatus === "PENDING" && (
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1">
                        <X size={12} />
                        Refuser
                      </Button>
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1">
                        <Check size={12} />
                        Approuver
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
