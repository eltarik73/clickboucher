"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Flag, ToggleLeft, ToggleRight } from "lucide-react";

type FeatureFlag = {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
};

export default function WebmasterFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/webmaster/flags");
      if (res.ok) {
        const json = await res.json();
        setFlags(json.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  async function toggleFlag(key: string, enabled: boolean) {
    // Optimistic
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)));

    try {
      const res = await fetch(`/api/webmaster/flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)));
      }
    } catch {
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Flag size={20} /> Feature Flags
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Activer ou desactiver les fonctionnalites de la plateforme
        </p>
      </div>

      <div className="space-y-2">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="flex items-center justify-between bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/[0.06] shadow-sm px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{flag.key}</p>
              {flag.description && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{flag.description}</p>
              )}
            </div>
            <button
              onClick={() => toggleFlag(flag.key, !flag.enabled)}
              className="shrink-0 ml-3"
              aria-label={flag.enabled ? "Desactiver" : "Activer"}
            >
              {flag.enabled ? (
                <ToggleRight size={32} className="text-[#DC2626]" />
              ) : (
                <ToggleLeft size={32} className="text-gray-300 dark:text-gray-600" />
              )}
            </button>
          </div>
        ))}

        {flags.length === 0 && (
          <p className="text-center text-gray-400 py-12">Aucun feature flag configure</p>
        )}
      </div>
    </div>
  );
}
