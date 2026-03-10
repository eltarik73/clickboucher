"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  AlertTriangle,
  TrendingUp,
  Timer,
  RefreshCw,
} from "lucide-react";

interface Metrics {
  acceptanceRate: number | null;
  avgPrepMinutes: number | null;
  cancelRate: number | null;
  responseMinutes: number | null;
  lateRate: number | null;
  avgRating: number | null;
  performanceScore: number | null;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: string;
  createdAt: string;
}

function ScoreGauge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 80 ? "#16a34a" : s >= 60 ? "#ca8a04" : s >= 40 ? "#ea580c" : "#DC2626";
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (s / 100) * circumference;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-white/10" />
        <circle
          cx="50" cy="50" r="45" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{s}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">/100</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  suffix?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{ backgroundColor: color + "15" }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-900 dark:text-[#f8f6f3]">{value}</span>
        {suffix && <span className="text-xs text-gray-500 dark:text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/boucher/performance");
      if (res.ok) {
        const json = await res.json();
        setMetrics(json.data?.metrics || null);
        setAlerts(json.data?.alerts || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  const pct = (v: number | null) => v !== null ? `${Math.round(v * 100)}%` : "—";
  const mins = (v: number | null) => v !== null ? `${Math.round(v)}` : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">Performance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Vos métriques des 30 derniers jours
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 p-4 rounded-2xl border ${
                a.severity === "critical"
                  ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                  : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
              }`}
            >
              <AlertTriangle
                size={18}
                className={a.severity === "critical" ? "text-red-500 mt-0.5" : "text-amber-500 mt-0.5"}
              />
              <div>
                <p className={`text-sm font-medium ${
                  a.severity === "critical" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                }`}>
                  {a.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Score */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-6 text-center">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Score Global</h2>
        <ScoreGauge score={metrics?.performanceScore ?? null} />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          {(metrics?.performanceScore ?? 0) >= 80
            ? "Excellent ! Continuez comme ça"
            : (metrics?.performanceScore ?? 0) >= 60
            ? "Bon score, quelques points à améliorer"
            : "Des améliorations sont nécessaires"}
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard
          icon={CheckCircle2}
          label="Taux d'acceptation"
          value={pct(metrics?.acceptanceRate ?? null)}
          color="#16a34a"
        />
        <MetricCard
          icon={XCircle}
          label="Taux d'annulation"
          value={pct(metrics?.cancelRate ?? null)}
          color="#DC2626"
        />
        <MetricCard
          icon={Clock}
          label="Temps de réponse"
          value={mins(metrics?.responseMinutes ?? null)}
          suffix="min"
          color="#2563eb"
        />
        <MetricCard
          icon={Timer}
          label="Préparation moy."
          value={mins(metrics?.avgPrepMinutes ?? null)}
          suffix="min"
          color="#7c3aed"
        />
        <MetricCard
          icon={TrendingUp}
          label="Taux de retard"
          value={pct(metrics?.lateRate ?? null)}
          color="#ea580c"
        />
        <MetricCard
          icon={Star}
          label="Note moyenne"
          value={metrics?.avgRating !== null && metrics?.avgRating !== undefined
            ? metrics.avgRating.toFixed(1)
            : "—"}
          suffix="/5"
          color="#ca8a04"
        />
      </div>

      {/* Tips */}
      <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-[#DC2626]" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">Conseils</h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>Acceptez les commandes dans les 10 minutes pour un meilleur score</li>
          <li>Respectez les délais estimés pour réduire le taux de retard</li>
          <li>Motivez les clients à laisser un avis après leur retrait</li>
        </ul>
      </div>
    </div>
  );
}
