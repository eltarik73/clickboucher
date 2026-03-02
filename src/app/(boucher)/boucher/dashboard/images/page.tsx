// src/app/(boucher)/boucher/dashboard/images/page.tsx — Boucher AI Image Gallery
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Download,
  Filter,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import ImageGenerator from "@/components/marketing/ImageGenerator";

type GenImage = {
  id: string;
  prompt: string;
  model: string;
  imageUrl: string;
  width: number;
  height: number;
  usage: string;
  createdAt: string;
};

type Tab = "generate" | "gallery";
type UsageFilter = "" | "CAMPAIGN" | "PROMO" | "PRODUCT" | "SOCIAL" | "BANNER";

const USAGE_LABELS: Record<string, string> = {
  CAMPAIGN: "Campagne",
  PROMO: "Promo",
  PRODUCT: "Produit",
  SOCIAL: "Réseaux",
  BANNER: "Bannière",
};

export default function BoucherImagesPage() {
  const [tab, setTab] = useState<Tab>("generate");
  const [images, setImages] = useState<GenImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<UsageFilter>("");

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("usage", filter);
      const res = await fetch(`/api/boucher/images/gallery?${params}`);
      if (res.ok) {
        const json = await res.json();
        setImages(json.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (tab === "gallery") fetchGallery();
  }, [tab, fetchGallery]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/boucher/dashboard" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-red-600" />
            Images IA
          </h1>
          <p className="text-sm text-gray-500">Générer des visuels pour vos promos et produits</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-white/10 pb-2">
        {([
          ["generate", "Générer", Sparkles],
          ["gallery", "Mes images", ImageIcon],
        ] as [Tab, string, typeof Sparkles][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-red-600 text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-white"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Generate */}
      {tab === "generate" && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-6">
          <ImageGenerator
            endpoint="/api/boucher/images/generate"
            defaultUsage="PROMO"
            compact
            onGenerated={() => {
              toast.success("Image ajoutée à votre galerie");
            }}
          />
        </div>
      )}

      {/* Gallery */}
      {tab === "gallery" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-gray-400" />
            <button
              onClick={() => setFilter("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                !filter ? "bg-red-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-500"
              }`}
            >
              Tous
            </button>
            {Object.entries(USAGE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key as UsageFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  filter === key ? "bg-red-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-red-600" size={24} />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
              <p>Aucune image générée</p>
              <button
                onClick={() => setTab("generate")}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Générer votre première image
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#141414]"
                >
                  <div className="aspect-square bg-gray-100 dark:bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageUrl}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-500 truncate">{img.prompt}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-400">
                      {USAGE_LABELS[img.usage] || img.usage}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={img.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-white/90 dark:bg-black/80 shadow"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
