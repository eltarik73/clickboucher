"use client";

import { useEffect, useState } from "react";
import { Crown, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type Feature = {
  id: string;
  plan: string;
  featureKey: string;
  featureName: string;
  description: string | null;
  enabled: boolean;
};

const PLANS = ["STARTER", "PRO", "PREMIUM"] as const;
const PLAN_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  STARTER: {
    bg: "bg-gray-50 dark:bg-white/5",
    border: "border-gray-200 dark:border-white/10",
    text: "text-gray-700 dark:text-gray-300",
    icon: "text-gray-400",
  },
  PRO: {
    bg: "bg-blue-50 dark:bg-blue-500/5",
    border: "border-blue-200 dark:border-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    icon: "text-blue-500",
  },
  PREMIUM: {
    bg: "bg-amber-50 dark:bg-amber-500/5",
    border: "border-amber-200 dark:border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    icon: "text-amber-500",
  },
};

export default function AdminFormulesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [newPlan, setNewPlan] = useState<string>("STARTER");
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/plan-features");
      const json = await res.json();
      setFeatures(json.data || json || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleFeature(id: string, enabled: boolean) {
    await fetch(`/api/admin/plan-features/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  }

  async function deleteFeature(id: string) {
    await fetch(`/api/admin/plan-features/${id}`, { method: "DELETE" });
    setFeatures((prev) => prev.filter((f) => f.id !== id));
  }

  async function createFeature(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await fetch("/api/admin/plan-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: newPlan,
          featureKey: newKey,
          featureName: newName,
          description: newDesc || undefined,
        }),
      });
      setShowForm(false);
      setNewKey("");
      setNewName("");
      setNewDesc("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            Formules & Features
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gérez les fonctionnalités incluses dans chaque formule
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] transition-colors"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createFeature} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Formule</label>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3]"
              >
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Clé</label>
              <input
                required
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="multi_images"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Images multiples"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={creating} className="px-5 py-2 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 transition-colors">
              {creating ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      )}

      {/* Features by plan */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const planFeatures = features.filter((f) => f.plan === plan);
          const colors = PLAN_COLORS[plan];
          return (
            <div key={plan} className={`rounded-xl border ${colors.border} shadow-sm overflow-hidden`}>
              <div className={`px-5 py-4 ${colors.bg} flex items-center gap-2`}>
                <Crown size={18} className={colors.icon} />
                <h2 className={`font-bold ${colors.text}`}>{plan}</h2>
                <span className="ml-auto text-xs text-gray-400">{planFeatures.length} feature(s)</span>
              </div>
              <div className="bg-white dark:bg-[#141414]">
                {planFeatures.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    Aucune feature configurée
                  </p>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-white/5">
                    {planFeatures.map((f) => (
                      <div key={f.id} className="px-5 py-3 flex items-center gap-3">
                        <button
                          onClick={() => toggleFeature(f.id, f.enabled)}
                          className="shrink-0"
                        >
                          {f.enabled ? (
                            <ToggleRight size={24} className="text-[#DC2626]" />
                          ) : (
                            <ToggleLeft size={24} className="text-gray-300 dark:text-gray-600" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${f.enabled ? "text-gray-900 dark:text-[#f8f6f3]" : "text-gray-400 dark:text-gray-500 line-through"}`}>
                            {f.featureName}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                            {f.featureKey}
                          </p>
                          {f.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {f.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteFeature(f.id)}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
