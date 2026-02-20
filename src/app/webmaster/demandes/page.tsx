"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/shared";

type ProRequest = {
  id: string;
  name: string;
  contact: string;
  type: string;
  status: "pending" | "approved" | "denied";
  date: string;
};

const INITIAL_REQUESTS: ProRequest[] = [
  { id: "pr1", name: "Restaurant Le Savoyard", contact: "Pierre D.", type: "Restaurant", status: "pending", date: "04/02/2026" },
  { id: "pr2", name: "Traiteur Alpes Events", contact: "Sarah K.", type: "Traiteur", status: "approved", date: "02/02/2026" },
];

export default function WebmasterDemandesPage() {
  const [requests, setRequests] = useState<ProRequest[]>(INITIAL_REQUESTS);

  const updateStatus = (id: string, status: "approved" | "denied") => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

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
                        {r.name}
                      </p>
                      <Badge variant="express">En attente</Badge>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-1">
                      {r.contact} &middot; {r.type} &middot; {r.date}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateStatus(r.id, "approved")}
                      className="px-4 py-2 text-[13px] font-semibold rounded-[14px] bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/15 transition-all"
                    >
                      Approuver
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "denied")}
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
            Trait&eacute;es ({resolved.length})
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
                        {r.name}
                      </p>
                      <Badge variant={r.status === "approved" ? "open" : "closed"}>
                        {r.status === "approved" ? "Approuv\u00e9" : "Refus\u00e9"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-1">
                      {r.contact} &middot; {r.type} &middot; {r.date}
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
          <p className="text-5xl">📩</p>
          <p className="text-base font-semibold text-gray-900 dark:text-[#f8f6f3] mt-4">
            Aucune demande
          </p>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-2">
            Les demandes PRO apparaitront ici.
          </p>
        </div>
      )}
    </div>
  );
}
