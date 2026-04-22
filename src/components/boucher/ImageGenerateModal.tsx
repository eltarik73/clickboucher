// src/components/boucher/ImageGenerateModal.tsx — Mode 1 UI (pure AI generation)
"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Sparkles, RefreshCw, ImageOff } from "lucide-react";
import PresetChips from "./image-studio/PresetChips";

type Usage = "PRODUCT" | "CAMPAIGN" | "BANNER";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, alt: string) => void;
  defaultQuery?: string;
  usage?: Usage;
};

type ResultImage = { id: string; url: string; finalPrompt?: string };

const PRESET_OPTIONS = [
  { value: "NONE", label: "Aucun" },
  { value: "STEAK", label: "Steak" },
  { value: "COTE", label: "Côte" },
  { value: "ESCALOPE", label: "Escalope" },
  { value: "MERGUEZ", label: "Merguez" },
  { value: "BROCHETTE", label: "Brochette" },
  { value: "PLATEAU", label: "Plateau" },
  { value: "MARINE", label: "Mariné" },
  { value: "SOUS_VIDE", label: "Sous-vide" },
];

const BG_OPTIONS = [
  { value: "WHITE", label: "Blanc studio" },
  { value: "WOOD", label: "Bois" },
  { value: "MARBLE", label: "Marbre" },
  { value: "DARK", label: "Sombre premium" },
];

const ANGLE_OPTIONS = [
  { value: "FRONT", label: "Face" },
  { value: "TOP", label: "Dessus" },
  { value: "45", label: "45°" },
  { value: "MACRO", label: "Macro" },
];

export default function ImageGenerateModal({
  open,
  onClose,
  onSelect,
  defaultQuery = "",
  usage = "PRODUCT",
}: Props) {
  const [prompt, setPrompt] = useState(defaultQuery);
  const [preset, setPreset] = useState<string>("NONE");
  const [background, setBackground] = useState<string>("WHITE");
  const [angle, setAngle] = useState<string>("45");
  const [enhancedPrompt, setEnhancedPrompt] = useState<string>("");
  const [enhancing, setEnhancing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPrompt(defaultQuery);
      setEnhancedPrompt("");
      setResults([]);
      setError(null);
    }
  }, [open, defaultQuery]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function enhance() {
    if (prompt.trim().length < 3) {
      setError("Décris d'abord ton produit (min 3 caractères)");
      return;
    }
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetch("/api/boucher/images/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, preset }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Erreur lors de l'amélioration");
        return;
      }
      setEnhancedPrompt(json.data.enhancedPrompt || "");
    } catch (e) {
      setError((e as Error).message || "Erreur réseau");
    } finally {
      setEnhancing(false);
    }
  }

  async function generate(variations = 4, replaceIdx: number | null = null) {
    if (prompt.trim().length < 3) {
      setError("Décris d'abord ton produit (min 3 caractères)");
      return;
    }
    if (replaceIdx === null) {
      setLoading(true);
      setResults([]);
    } else {
      setRegenIdx(replaceIdx);
    }
    setError(null);
    try {
      const res = await fetch("/api/boucher/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          preset,
          background,
          angle,
          variations,
          usage,
          finalPromptOverride: enhancedPrompt.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Erreur lors de la génération");
        return;
      }
      const newImgs: ResultImage[] = json.data.images;
      const failures = Array.isArray(json.data.failures) ? json.data.failures.length : 0;
      if (replaceIdx === null) {
        setResults(newImgs);
        if (failures > 0 && newImgs.length > 0) {
          setError(
            `${newImgs.length}/${variations} variation${variations > 1 ? "s" : ""} générée${newImgs.length > 1 ? "s" : ""}. ` +
              `Les autres ont été limitées par Replicate (crédit faible). ` +
              `Clique "Régénérer" sur une case vide ou ajoute du crédit sur replicate.com.`
          );
        }
      } else if (newImgs[0]) {
        setResults((prev) =>
          prev.map((img, i) => (i === replaceIdx ? newImgs[0] : img))
        );
      }
    } catch (e) {
      setError((e as Error).message || "Erreur réseau");
    } finally {
      setLoading(false);
      setRegenIdx(null);
    }
  }

  function pick(img: ResultImage) {
    onSelect(img.url, prompt || "image IA");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl h-[95vh] sm:h-[90vh] bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden font-[var(--font-outfit)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles size={20} className="text-[#DC2626]" />
              Générer avec l'IA
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Crée 4 photos studio haute qualité à partir d'une description
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Section 1: describe */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              1. Décris ton produit
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Ex: côte de bœuf bien marbrée sur planche en bois"
              className="w-full rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#141414] px-3 py-2.5 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
            />
          </div>

          {/* Section 2: preset */}
          <PresetChips
            label="2. Preset boucherie"
            value={preset}
            options={PRESET_OPTIONS}
            onChange={setPreset}
          />

          {/* Section 3: background */}
          <PresetChips
            label="3. Fond"
            value={background}
            options={BG_OPTIONS}
            onChange={setBackground}
          />

          {/* Section 4: angle */}
          <PresetChips
            label="4. Angle"
            value={angle}
            options={ANGLE_OPTIONS}
            onChange={setAngle}
          />

          {/* Enhance */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Prompt final (EN) — éditable
              </div>
              <button
                type="button"
                onClick={enhance}
                disabled={enhancing}
                className="h-9 px-3 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-[#DC2626] hover:text-white text-xs font-semibold text-gray-700 dark:text-gray-300 border border-transparent hover:border-[#DC2626] transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {enhancing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                Améliorer mon prompt
              </button>
            </div>
            <textarea
              value={enhancedPrompt}
              onChange={(e) => setEnhancedPrompt(e.target.value)}
              rows={3}
              placeholder="(Optionnel) Le prompt est généré automatiquement — tu peux le surcharger ici."
              className="w-full rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#141414] px-3 py-2.5 text-xs font-mono text-gray-700 dark:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
            />
          </div>

          {/* Main action */}
          <div>
            <button
              type="button"
              onClick={() => generate(4, null)}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Génération en cours (10-30s)...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Générer 4 variations
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {loading && (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500 dark:text-gray-400">
              <ImageOff size={36} className="mb-2" />
              <p className="text-sm">Les variations apparaîtront ici</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {results.map((img, idx) => {
                const isRegenerating = regenIdx === idx;
                return (
                  <div key={img.id + idx} className="relative group">
                    <button
                      type="button"
                      onClick={() => pick(img)}
                      disabled={isRegenerating}
                      className="relative block w-full aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#DC2626] transition-all disabled:opacity-60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt="variation IA"
                        className="w-full h-full object-cover object-center"
                      />
                      {isRegenerating && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 size={28} className="animate-spin text-white" />
                        </div>
                      )}
                      {!isRegenerating && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#DC2626] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                            Utiliser cette image
                          </span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        generate(1, idx);
                      }}
                      disabled={regenIdx !== null || loading}
                      className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/70 hover:bg-[#DC2626] flex items-center justify-center text-white transition-colors disabled:opacity-60"
                      aria-label="Régénérer cette image"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
