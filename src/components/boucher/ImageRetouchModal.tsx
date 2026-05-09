// src/components/boucher/ImageRetouchModal.tsx — Mode 2 UI (image-to-image retouch)
"use client";

import { useEffect, useRef, useState } from "react";
import { proxied } from "@/lib/proxy-image";
import {
  X,
  Loader2,
  Upload,
  ImageIcon,
  Palette,
  Lightbulb,
  Ruler,
  Sparkles,
  Check,
} from "lucide-react";
import PresetChips from "./image-studio/PresetChips";

type Usage = "PRODUCT" | "CAMPAIGN" | "BANNER";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, alt: string) => void;
  defaultQuery?: string;
  usage?: Usage;
  sourceImageUrl?: string;
};

type ResultImage = { id: string; url: string };

const PRESET_OPTIONS = [
  { value: "CLEAN_BACKGROUND", label: "Fond propre", Icon: Palette },
  { value: "STUDIO_LIGHT", label: "Lumière studio", Icon: Lightbulb },
  { value: "CATALOG_45", label: "Vue catalogue 45°", Icon: Ruler },
  { value: "APPETIZING", label: "Appétissant", Icon: Sparkles },
] as const;

export default function ImageRetouchModal({
  open,
  onClose,
  onSelect,
  defaultQuery = "",
  usage = "PRODUCT",
  sourceImageUrl,
}: Props) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(sourceImageUrl ?? null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<string>("CLEAN_BACKGROUND");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [originalServerUrl, setOriginalServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSourceUrl(sourceImageUrl ?? null);
      setSourceFile(null);
      setResults([]);
      setOriginalServerUrl(null);
      setError(null);
      setPreset("CLEAN_BACKGROUND");
      setCustomPrompt("");
      setShowCustom(false);
    }
  }, [open, sourceImageUrl]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function handleFile(f: File | null | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError("Image trop lourde (max 5MB)");
      return;
    }
    setSourceFile(f);
    setSourceUrl(URL.createObjectURL(f));
    setError(null);
  }

  async function retouch() {
    if (!sourceUrl) {
      setError("Choisis d'abord une image source");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      let res: Response;
      if (sourceFile) {
        const form = new FormData();
        form.append("file", sourceFile);
        form.append("preset", preset);
        form.append("variations", "4");
        form.append("usage", usage);
        if (customPrompt.trim()) form.append("customPrompt", customPrompt.trim());
        res = await fetch("/api/boucher/images/retouch", {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch("/api/boucher/images/retouch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: sourceUrl,
            preset,
            variations: 4,
            usage,
            customPrompt: customPrompt.trim() || undefined,
          }),
        });
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Erreur lors de la retouche");
        return;
      }
      setOriginalServerUrl(json.data.originalUrl);
      setResults(json.data.images || []);
    } catch (e) {
      setError((e as Error).message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  function pick(img: ResultImage) {
    onSelect(img.url, defaultQuery || "photo retouchée");
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-retouch-title"
    >
      <div className="flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white font-[var(--font-outfit)] shadow-elevated dark:border-white/10 dark:bg-[#0a0a0a] sm:h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
          <div>
            <h2
              id="image-retouch-title"
              className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white sm:text-xl"
            >
              <ImageIcon size={20} className="text-[#DC2626]" aria-hidden="true" />
              Retoucher une photo
            </h2>
            <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Check size={12} className="text-green-500" />
              L'original reste toujours disponible
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
          >
            <X size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Section 1: source */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              1. Photo source
            </div>
            {sourceUrl ? (
              <div className="relative">
                <div className="aspect-[4/3] max-w-md overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(sourceUrl)}
                    alt="source"
                    className="h-full w-full object-cover object-center"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSourceUrl(null);
                    setSourceFile(null);
                  }}
                  className="mt-2 text-xs font-semibold text-gray-500 hover:text-[#DC2626] dark:text-gray-400"
                >
                  Changer d'image
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[4/3] w-full max-w-md flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 transition-colors hover:border-[#DC2626] hover:text-[#DC2626] dark:border-white/15 dark:text-gray-400"
              >
                <Upload size={32} />
                <span className="text-sm font-medium">Choisis ou glisse ta photo</span>
                <span className="text-xs">JPG, PNG ou WebP — max 5MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {/* Section 2: preset */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              2. Style de retouche
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESET_OPTIONS.map(({ value, label, Icon }) => {
                const active = preset === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPreset(value)}
                    className={[
                      "flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center transition-colors",
                      active
                        ? "border-[#DC2626] bg-[#DC2626] text-white"
                        : "border-transparent bg-gray-100 text-gray-700 hover:border-[#DC2626] hover:text-[#DC2626] dark:bg-white/5 dark:text-gray-300",
                    ].join(" ")}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-medium leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: custom prompt */}
          <div>
            <button
              type="button"
              onClick={() => setShowCustom((v) => !v)}
              className="text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-[#DC2626] dark:text-gray-400"
            >
              3. Instructions spécifiques (optionnel) {showCustom ? "▲" : "▼"}
            </button>
            {showCustom && (
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                placeholder="Ex: ajouter de la vapeur, renforcer le rouge de la viande..."
                maxLength={300}
                className="mt-2 w-full resize-none rounded-xl border border-[#ece8e3] bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-white"
              />
            )}
          </div>

          {/* Main action */}
          <button
            type="button"
            onClick={retouch}
            disabled={loading || !sourceUrl}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#DC2626] text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Retouche en cours (15-40s)...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Générer 4 versions
              </>
            )}
          </button>

          {/* Results */}
          {loading && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
              {sourceUrl && (
                <div className="aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(sourceUrl)}
                    alt="original"
                    className="h-full w-full object-cover object-center opacity-60"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-square animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Original
                </div>
                <div className="aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(originalServerUrl || sourceUrl || "")}
                    alt="original"
                    className="h-full w-full object-cover object-center"
                  />
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Variantes retouchées
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {results.map((img, idx) => (
                    <button
                      key={img.id + idx}
                      type="button"
                      onClick={() => pick(img)}
                      className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 transition-all hover:border-[#DC2626] dark:border-white/10 dark:bg-white/5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proxied(img.url)}
                        alt="retouche"
                        className="h-full w-full object-cover object-center"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                        <span className="rounded-full bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Utiliser cette image
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer link */}
        <div className="shrink-0 border-t border-[#ece8e3] bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5 sm:px-6">
          <a
            href="/boucher/images"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-[#DC2626] hover:underline"
          >
            📚 Voir mes images précédentes
          </a>
        </div>
      </div>
    </div>
  );
}
