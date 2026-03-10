"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Shield, ChevronLeft, ChevronRight } from "lucide-react";

type AuditEntry = {
  id: string;
  actorId: string;
  action: string;
  target: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export default function WebmasterAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webmaster/audit?page=${page}&perPage=${perPage}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data?.logs || []);
        setTotal(json.data?.total || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield size={20} /> Audit Log
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Historique des actions administrateur
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-gray-500 py-12">Aucune action enregistree</p>
      ) : (
        <>
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/5">
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acteur</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cible</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                        {log.actorId}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                        {log.target && <span>{log.target}</span>}
                        {log.targetId && <span className="text-gray-400 dark:text-gray-500"> #{log.targetId.slice(-6)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
