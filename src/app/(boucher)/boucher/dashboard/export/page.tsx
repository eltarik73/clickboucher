// /boucher/dashboard/export — Export commandes avec filtres
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "COMPLETED", label: "Terminée" },
  { value: "PICKED_UP", label: "Récupérée" },
  { value: "CANCELLED", label: "Annulée" },
  { value: "DENIED", label: "Refusée" },
  { value: "AUTO_CANCELLED", label: "Auto-annulée" },
  { value: "PENDING", label: "En attente" },
  { value: "ACCEPTED", label: "Acceptée" },
  { value: "PREPARING", label: "En préparation" },
  { value: "READY", label: "Prête" },
] as const;

type PreviewData = {
  count: number;
  totalCents: number;
  rows: {
    numero: string;
    date: string;
    client: string;
    status: string;
    total: string;
    articles: string;
  }[];
};

export default function ExportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "COMPLETED",
    "PICKED_UP",
  ]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (selectedStatuses.length > 0 && selectedStatuses.length < STATUS_OPTIONS.length) {
      params.set("status", selectedStatuses.join(","));
    }
    return params;
  }, [from, to, selectedStatuses]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      params.set("format", "csv");
      const res = await fetch(`/api/orders/export?${params.toString()}`);
      if (!res.ok) {
        toast.error("Erreur lors du chargement");
        return;
      }
      const text = await res.text();
      const lines = text.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
      if (lines.length <= 1) {
        setPreview({ count: 0, totalCents: 0, rows: [] });
        return;
      }

      const dataLines = lines.slice(1);
      let totalCents = 0;
      const rows = dataLines.slice(0, 10).map((line) => {
        const cols = line.split(";").map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
        const eurStr = cols[9] || "0";
        const cents = Math.round(parseFloat(eurStr.replace(",", ".")) * 100);
        totalCents += cents;
        return {
          numero: cols[0] || "",
          date: cols[1] || "",
          client: cols[3] || "",
          status: cols[7] || "",
          total: eurStr,
          articles: cols[8] || "",
        };
      });

      // Calculate full total from all lines
      if (dataLines.length > 10) {
        totalCents = 0;
        for (const line of dataLines) {
          const cols = line.split(";").map((c) => c.replace(/^"|"$/g, ""));
          totalCents += Math.round(parseFloat((cols[9] || "0").replace(",", ".")) * 100);
        }
      }

      setPreview({ count: dataLines.length, totalCents, rows });
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = buildParams();
      params.set("format", "csv");
      const res = await fetch(`/api/orders/export?${params.toString()}`);
      if (!res.ok) { toast.error("Erreur export"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commandes-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("CSV téléchargé");
    } catch {
      toast.error("Erreur export");
    } finally {
      setExporting(false);
    }
  };

  const exportPrint = () => {
    const params = buildParams();
    params.set("format", "print");
    window.open(`/api/orders/export?${params.toString()}`, "_blank");
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const selectAll = () => setSelectedStatuses(STATUS_OPTIONS.map((s) => s.value));
  const selectNone = () => setSelectedStatuses([]);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/boucher/dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={16} className="text-gray-700 dark:text-gray-300" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Exporter les commandes
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              CSV pour Excel ou impression PDF
            </p>
          </div>
          <FileSpreadsheet size={20} className="text-gray-500 dark:text-gray-400" />
        </div>

        {/* Date filters */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Période
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Du</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to}
                className="w-full px-3 py-2.5 bg-[#f8f6f3] dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Au</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
                max={today}
                className="w-full px-3 py-2.5 bg-[#f8f6f3] dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30"
              />
            </div>
          </div>
        </div>

        {/* Status filter */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Statuts
            </h2>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[11px] text-[#DC2626] hover:underline font-medium"
              >
                Tout
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={selectNone}
                className="text-[11px] text-gray-500 hover:underline font-medium"
              >
                Aucun
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => toggleStatus(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStatuses.includes(s.value)
                    ? "bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-red-400"
                    : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview button */}
        <button
          onClick={loadPreview}
          disabled={loading || selectedStatuses.length === 0}
          className="w-full py-3 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Chargement...
            </>
          ) : (
            "Apercu"
          )}
        </button>

        {/* Preview results */}
        {preview && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            {/* Summary */}
            <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-white/10 border-b border-gray-200 dark:border-white/10">
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commandes</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{preview.count}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">CA Total</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {(preview.totalCents / 100).toFixed(2).replace(".", ",")} &euro;
                </p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Panier moyen</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {preview.count > 0
                    ? (preview.totalCents / preview.count / 100).toFixed(2).replace(".", ",")
                    : "0,00"}{" "}
                  &euro;
                </p>
              </div>
            </div>

            {/* Table preview */}
            {preview.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">N°</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Date</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Client</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Statut</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Articles</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-white/5">
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">{r.numero}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{r.date}</td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{r.client}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{r.status}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{r.articles}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300 font-medium">{r.total} &euro;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.count > 10 && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-2">
                    ... et {preview.count - 10} autres commandes
                  </p>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">
                Aucune commande pour cette période et ces filtres
              </div>
            )}

            {/* Export buttons */}
            {preview.count > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-white/10 flex gap-3">
                <button
                  onClick={exportCSV}
                  disabled={exporting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
                >
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  CSV (Excel)
                </button>
                <button
                  onClick={exportPrint}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                >
                  <Printer size={16} />
                  Imprimer / PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
