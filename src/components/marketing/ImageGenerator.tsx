// src/components/marketing/ImageGenerator.tsx — Stub (used by banners page)
"use client";

import { useState } from "react";
import { Sparkles, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  endpoint: string;
  defaultUsage?: string;
  compact?: boolean;
  onGenerated?: (img: { imageUrl: string }) => void;
};

export default function ImageGenerator({ endpoint, defaultUsage, compact, onGenerated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, usage: defaultUsage || "BANNER" }),
      });
      const json = await res.json();
      if (json.success && json.data?.imageUrl) {
        onGenerated?.({ imageUrl: json.data.imageUrl });
        toast.success("Image générée");
      } else {
        toast.error(json.error || "Erreur génération");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Décrivez l'image souhaitée..."
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
        />
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Générer
        </button>
      </div>
    </div>
  );
}
