"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type ProRequest = {
  id: string;
  companyName: string;
  siret: string;
  sector: string;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
};

export default function WebmasterDemandesPage() {
  const [requests, setRequests] = useState<ProRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch users with PRO_PENDING status
    fetch("/api/admin/users?role=CLIENT_PRO_PENDING")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) {
          // Map users to pro request format
          const mapped = json.data.map((u: Record<string, unknown>) => ({
            id: u.id as string,
            companyName: (u.companyName as string) || "Entreprise",
            siret: (u.siret as string) || "",
            sector: (u.sector as string) || "Autre",
            status: (u.proStatus as string) || "PENDING",
            createdAt: u.createdAt as string,
            user: { firstName: u.firstName as string, lastName: u.lastName as string, email: u.email as string },
          }));
          setRequests(mapped);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(userId: string, action: "APPROVED" | "REJECTED") {
    // Optimistic
    setRequests((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, status: action } : r))
    );
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: action === "APPROVED" ? "CLIENT_PRO" : "CLIENT",
          proStatus: action,
        }),
      });
    } catch {
      // Revert
      setRequests((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, status: "PENDING" } : r))
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="flex flex-col gap-4">
      {/* Pending section */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-2">
            En attente ({pending.length})
          </h3>
          <div className="flex flex-col gap-2.5">
            {pending.map((r, i) => (
              <div
                key={r.id}
                className="bg-white dark:bg-[#141414] rounded-[20px] border border-stone-200 dark:border-white/10 shadow-sm p-4 animate-fade-up"
                style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">
                        {r.companyName}
                      </p>
                      <Badge variant="warning">En attente</Badge>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-1">
                      {r.user ? `${r.user.firstName} ${r.user.lastName}` : "?"} &middot; {r.sector}
                      {r.siret ? ` \u00B7 SIRET ${r.siret}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateStatus(r.id, "APPROVED")}
                      className="px-4 py-2 text-[13px] font-semibold rounded-[14px] bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/15 transition-all"
                    >
                      Approuver
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "REJECTED")}
                      className="px-4 py-2 text-[13px] font-semibold rounded-[14px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 transition-all"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved section */}
      {resolved.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Traitees ({resolved.length})
          </h3>
          <div className="flex flex-col gap-2.5">
            {resolved.map((r, i) => (
              <div
                key={r.id}
                className="bg-white dark:bg-[#141414] rounded-[20px] border border-stone-200 dark:border-white/10 shadow-sm p-4 animate-fade-up"
                style={{ animationDelay: `${(pending.length + i) * 70}ms` } as React.CSSProperties}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">
                        {r.companyName}
                      </p>
                      <Badge variant={r.status === "APPROVED" ? "success" : "destructive"}>
                        {r.status === "APPROVED" ? "Approuve" : "Refuse"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-1">
                      {r.user ? `${r.user.firstName} ${r.user.lastName}` : "?"} &middot; {r.sector}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <p className="text-5xl">&#128233;</p>
          <p className="text-base font-semibold text-gray-900 dark:text-[#f8f6f3] mt-4">
            Aucune demande PRO
          </p>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-2">
            Les demandes PRO apparaitront ici.
          </p>
        </div>
      )}
    </div>
  );
}
