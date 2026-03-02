// src/components/marketing/ImageGenerator.tsx — AI Image Generator component
"use client";

import { useState } from "react";
import {
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Download,
  Copy,
  Check,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

type ImageUsage = "CAMPAIGN" | "PROMO" | "PRODUCT" | "SOCIAL" | "BANNER";
type ImageModel = "FLUX_SCHNELL" | "FLUX_PRO" | "IDEOGRAM";

type GeneratedImg = {
  id: string;
  prompt: string;
  model: string;
  imageUrl: string;
  width: number;
  height: number;
  usage: string;
};

type Props = {
  /** API endpoint — "/api/admin/images/generate" or "/api/boucher/images/generate" */
  endpoint: string;
  /** Default usage preset */
  defaultUsage?: ImageUsage;
  /** Called when an image is generated (for parent integration) */
  onGenerated?: (img: GeneratedImg) => void;
  /** Compact mode (hide model selector) */
  compact?: boolean;
};

const USAGE_LABELS: Record<ImageUsage, string> = {
  CAMPAIGN: "Email / Campagne",
  PROMO: "Affiche promo",
  PRODUCT: "Photo produit",
  SOCIAL: "Story / Réseaux",
  BANNER: "Bannière site",
};

const MODEL_LABELS: Record<ImageModel, { label: string; desc: string }> = {
  FLUX_SCHNELL: { label: "FLUX Rapide", desc: "Rapide, aperçu" },
  FLUX_PRO: { label: "FLUX Pro", desc: "Haute qualité" },
  IDEOGRAM: { label: "Ideogram", desc: "Texte intégré" },
};

const PROMPT_SUGGESTIONS: Record<ImageUsage, string[]> = {
  CAMPAIGN: [
    "Plateau de viande grillée avec légumes frais et herbes aromatiques",
    "Étal de boucherie artisanale avec viandes premium",
    "BBQ convivial en famille avec assortiment de viandes",
  ],
  PROMO: [
    "Côte de bœuf juteuse avec badge -20% sur fond rouge",
    "Promotion spéciale merguez et brochettes d'été",
    "Offre spéciale plateau raclette avec charcuterie",
  ],
  PRODUCT: [
    "Entrecôte de bœuf maturée sur planche en bois",
    "Assortiment de saucisses artisanales",
    "Carré d'agneau rôti avec romarin",
  ],
  SOCIAL: [
    "Coulisses de la boucherie artisanale, découpe au couteau",
    "Burger gourmet fait maison avec steak haché frais",
    "Viande marinée prête pour le barbecue",
  ],
  BANNER: [
    "Étal de boucherie traditionnel avec viandes premium et épices",
    "Ambiance chaleureuse de boucherie artisanale française",
    "Sélection de viandes nobles sur ardoise",
  ],
};

export default function ImageGenerator({ endpoint, defaultUsage = "PROMO", onGenerated, compact }: Props) {
  const [prompt, setPrompt] = useState("");
  const [usage, setUsage] = useState<ImageUsage>(defaultUsage);
  const [model, setModel] = useState<ImageModel | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedImg | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!prompt.trim() || prompt.length < 5) {
      toast.error("Prompt trop court (min 5 caractères)");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          usage,
          ...(model ? { model } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Erreur de génération");
        return;
      }
      setResult(json.data);
      onGenerated?.(json.data);
      toast.success("Image générée !");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.imageUrl);
    setCopied(true);
    toast.success("URL copiée !");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Usage selector */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Type d&apos;image</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(USAGE_LABELS) as [ImageUsage, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setUsage(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                usage === key
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Model selector (unless compact) */}
      {!compact && (
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Modèle IA (optionnel)</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModel("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !model
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              Auto
            </button>
            {(Object.entries(MODEL_LABELS) as [ImageModel, { label: string; desc: string }][]).map(
              ([key, { label, desc }]) => (
                <button
                  key={key}
                  onClick={() => setModel(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    model === key
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                  title={desc}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Prompt input */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Description de l&apos;image</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Décrivez l'image souhaitée en français..."
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400">{prompt.length}/500</span>
        </div>
      </div>

      {/* Prompt suggestions */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
          <Wand2 size={12} /> Suggestions
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PROMPT_SUGGESTIONS[usage].map((s, i) => (
            <button
              key={i}
              onClick={() => setPrompt(s)}
              className="px-2.5 py-1 rounded-lg text-xs bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 truncate max-w-[250px]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={loading || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Génération en cours...
          </>
        ) : (
          <>
            <Sparkles size={18} /> Générer l&apos;image
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="relative aspect-video bg-gray-100 dark:bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.imageUrl}
              alt={result.prompt}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="p-3 flex items-center gap-2">
            <span className="flex-1 text-xs text-gray-500 truncate">
              <ImageIcon size={12} className="inline mr-1" />
              {result.model} · {result.width}×{result.height}
            </span>
            <a
              href={result.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10"
              title="Télécharger"
            >
              <Download size={14} className="text-gray-500" />
            </a>
            <button
              onClick={copyUrl}
              className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10"
              title="Copier l'URL"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
